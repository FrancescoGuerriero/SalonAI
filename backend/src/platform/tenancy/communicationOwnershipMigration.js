import { createHash } from "node:crypto";

function text(value) {
  return String(value ?? "").trim();
}

function id(value) {
  const candidate = value?._id ?? value;
  return text(candidate) || null;
}

function normalise(records = []) {
  return [...(Array.isArray(records) ? records : [])]
    .map((record) => ({
      _id: id(record?._id),
      business: id(record?.business),
      location: id(record?.location),
      campaign: id(record?.campaign),
      appointment: id(record?.appointment),
      template: id(record?.template),
      customer: id(record?.customer),
      slug: text(record?.slug).toLowerCase() || null,
      providerMessageId: text(record?.providerMessageId) || null,
      externalMessageId: text(record?.externalMessageId) || null,
    }))
    .sort((left, right) => text(left._id).localeCompare(text(right._id)));
}

function duplicateValues(records, field) {
  const counts = new Map();
  for (const record of records) {
    const value = record[field];
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function coverage(records, targetBusinessId, targetLocationId) {
  let unownedBusiness = 0;
  let targetOwned = 0;
  let foreignBusiness = 0;
  let missingLocation = 0;
  let targetLocation = 0;
  let foreignLocation = 0;

  for (const record of records) {
    if (!record.business) unownedBusiness += 1;
    else if (record.business === targetBusinessId) targetOwned += 1;
    else foreignBusiness += 1;

    if (!record.location) missingLocation += 1;
    else if (record.location === targetLocationId) targetLocation += 1;
    else foreignLocation += 1;
  }

  return Object.freeze({
    total: records.length,
    unownedBusiness,
    targetOwned,
    foreignBusiness,
    missingLocation,
    targetLocation,
    foreignLocation,
  });
}

export function buildCommunicationOwnershipPlan({
  business,
  location,
  campaigns = [],
  recipients = [],
  templates = [],
  scheduledCommunications = [],
  messageDeliveries = [],
} = {}) {
  const targetBusinessId = id(business);
  const targetLocationId = id(location);
  const normalisedCampaigns = normalise(campaigns);
  const normalisedRecipients = normalise(recipients);
  const normalisedTemplates = normalise(templates);
  const normalisedScheduled = normalise(scheduledCommunications);
  const normalisedDeliveries = normalise(messageDeliveries);
  const blockers = [];
  const operations = [];

  if (!targetBusinessId) blockers.push({ type: "canonical-business-missing" });
  if (!targetLocationId) blockers.push({ type: "canonical-location-missing" });

  const duplicateCampaignSlugs = duplicateValues(normalisedCampaigns, "slug");
  const duplicateTemplateSlugs = duplicateValues(normalisedTemplates, "slug");
  if (duplicateCampaignSlugs.length) {
    blockers.push({ type: "duplicate-campaign-slug", count: duplicateCampaignSlugs.length });
  }
  if (duplicateTemplateSlugs.length) {
    blockers.push({ type: "duplicate-template-slug", count: duplicateTemplateSlugs.length });
  }

  const campaignById = new Map(
    normalisedCampaigns.filter((item) => item._id).map((item) => [item._id, item])
  );

  for (const recipient of normalisedRecipients) {
    if (!recipient.campaign || !campaignById.has(recipient.campaign)) {
      blockers.push({ type: "recipient-orphan-campaign", recordType: "CommunicationCampaignRecipient" });
    }
  }

  function desiredLocation(record, recordType) {
    if (record.location) return record.location;
    if (
      (recordType === "CommunicationCampaignRecipient" ||
        recordType === "ScheduledCommunication") &&
      record.appointment
    ) {
      return targetLocationId;
    }
    if (
      (recordType === "CommunicationCampaignRecipient" ||
        recordType === "MessageDelivery") &&
      record.campaign
    ) {
      return campaignById.get(record.campaign)?.location || null;
    }
    return null;
  }

  const groups = [
    ["CommunicationCampaign", "campaign-update", normalisedCampaigns],
    ["CommunicationCampaignRecipient", "recipient-update", normalisedRecipients],
    ["CommunicationTemplate", "template-update", normalisedTemplates],
    ["ScheduledCommunication", "scheduled-communication-update", normalisedScheduled],
    ["MessageDelivery", "message-delivery-update", normalisedDeliveries],
  ];

  for (const [recordType, operationType, records] of groups) {
    for (const record of records) {
      if (record.business && targetBusinessId && record.business !== targetBusinessId) {
        blockers.push({ type: "foreign-business-ownership", recordType });
      }
      if (record.location && targetLocationId && record.location !== targetLocationId) {
        blockers.push({ type: "foreign-location-ownership", recordType });
      }

      const set = {};
      if (!record.business && targetBusinessId) set.business = targetBusinessId;
      const locationToSet = desiredLocation(record, recordType);
      if (!record.location && locationToSet) set.location = locationToSet;

      if (record._id && Object.keys(set).length > 0) {
        operations.push({
          type: operationType,
          recordType,
          recordId: record._id,
          set,
        });
      }
    }
  }

  operations.sort((left, right) =>
    `${left.recordType}:${left.recordId}`.localeCompare(`${right.recordType}:${right.recordId}`)
  );

  const planCoverage = Object.freeze({
    campaigns: coverage(normalisedCampaigns, targetBusinessId, targetLocationId),
    recipients: coverage(normalisedRecipients, targetBusinessId, targetLocationId),
    templates: coverage(normalisedTemplates, targetBusinessId, targetLocationId),
    scheduledCommunications: coverage(normalisedScheduled, targetBusinessId, targetLocationId),
    messageDeliveries: coverage(normalisedDeliveries, targetBusinessId, targetLocationId),
  });

  const summary = Object.freeze({
    campaignCount: normalisedCampaigns.length,
    recipientCount: normalisedRecipients.length,
    templateCount: normalisedTemplates.length,
    scheduledCommunicationCount: normalisedScheduled.length,
    messageDeliveryCount: normalisedDeliveries.length,
    operationCount: operations.length,
    blockerCount: blockers.length,
  });

  const executable = Boolean(targetBusinessId && targetLocationId && blockers.length === 0);

  return Object.freeze({
    executable,
    idempotentNoop: executable && operations.length === 0,
    target: Object.freeze({ businessId: targetBusinessId, locationId: targetLocationId }),
    coverage: planCoverage,
    summary,
    blockers: Object.freeze(blockers),
    operations: Object.freeze(operations),
  });
}

export function calculateCommunicationOwnershipPlanFingerprint(plan) {
  const payload = JSON.stringify({
    target: plan?.target || null,
    coverage: plan?.coverage || null,
    summary: plan?.summary || null,
    blockers: plan?.blockers || [],
    operations: plan?.operations || [],
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function sanitiseCommunicationOwnershipPlan(plan) {
  const counts = (items = []) =>
    Object.freeze(
      items.reduce((result, item) => {
        const key = text(item?.type) || "unknown";
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {})
    );

  return Object.freeze({
    readOnly: true,
    writesPerformed: false,
    executable: Boolean(plan?.executable),
    idempotentNoop: Boolean(plan?.idempotentNoop),
    coverage: plan?.coverage || {},
    summary: plan?.summary || {},
    blockerTypes: counts(plan?.blockers || []),
    operationTypes: counts(plan?.operations || []),
    identifiersIncluded: false,
    piiIncluded: false,
  });
}
