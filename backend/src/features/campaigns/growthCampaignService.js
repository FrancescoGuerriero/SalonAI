import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Lead from "../../models/Lead.js";
import Customer from "../../models/customer.js";
import Opportunity from "../../models/Opportunity.js";
import Campaign from "./Campaign.js";
import CampaignExecution from "./CampaignExecution.js";
import AttributionTouch from "./AttributionTouch.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function identifier(value) {
  return value?._id || value?.id || value || null;
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const result = identifier(value);
  if (!mongoose.isValidObjectId(result)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return result;
}

function locationAuthority(businessId, locationId) {
  objectId(businessId, "business");
  objectId(locationId, "location");
  return { business: businessId, location: locationId };
}

function date(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return result;
}

function slug(value) {
  return lower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function normaliseUtm(payload = {}) {
  const supplied = payload.utm && typeof payload.utm === "object" ? payload.utm : {};
  return {
    source: lower(supplied.source || payload.utmSource),
    medium: lower(supplied.medium || payload.utmMedium),
    campaign: text(supplied.campaign || payload.utmCampaign),
    term: text(supplied.term || payload.utmTerm),
    content: text(supplied.content || payload.utmContent),
  };
}

function stableKey(parts) {
  return createHash("sha256")
    .update(parts.map((part) => text(part)).join(":"))
    .digest("hex");
}

async function campaignForBusiness(campaignId, businessId) {
  objectId(businessId, "business");
  objectId(campaignId, "campaign");
  const campaign = await Campaign.findOne({
    _id: campaignId,
    business: businessId,
  });
  if (!campaign) {
    throw createServiceError("Campaign not found in the active business.", 404);
  }
  return campaign;
}

async function validateAttributionSubjects(
  { lead, customer, opportunity },
  businessId,
  locationId
) {
  const authority = locationAuthority(businessId, locationId);
  const [leadRecord, customerRecord, opportunityRecord] = await Promise.all([
    lead
      ? Lead.findOne({ _id: lead, ...authority }).select("_id customer location").lean()
      : null,
    customer
      ? Customer.findOne({
          _id: customer,
          business: businessId,
          status: { $ne: "deleted" },
        })
          .select("_id")
          .lean()
      : null,
    opportunity
      ? Opportunity.findOne({ _id: opportunity, ...authority })
          .select("_id lead customer location")
          .lean()
      : null,
  ]);

  if (lead && !leadRecord) {
    throw createServiceError("Attribution lead not found in the selected location.", 404, {
      code: "ATTRIBUTION_LOCATION_MISMATCH",
    });
  }
  if (customer && !customerRecord) {
    throw createServiceError("Attribution customer not found in the active business.", 404);
  }
  if (opportunity && !opportunityRecord) {
    throw createServiceError("Attribution opportunity not found in the selected location.", 404, {
      code: "ATTRIBUTION_LOCATION_MISMATCH",
    });
  }
  if (
    opportunityRecord?.lead &&
    lead &&
    String(opportunityRecord.lead) !== String(lead)
  ) {
    throw createServiceError(
      "Attribution opportunity does not belong to the supplied lead.",
      409,
      { code: "ATTRIBUTION_SUBJECT_MISMATCH" }
    );
  }
  if (
    opportunityRecord?.customer &&
    customer &&
    String(opportunityRecord.customer) !== String(customer)
  ) {
    throw createServiceError(
      "Attribution opportunity does not belong to the supplied customer.",
      409,
      { code: "ATTRIBUTION_SUBJECT_MISMATCH" }
    );
  }
  if (
    leadRecord?.customer &&
    customer &&
    String(leadRecord.customer) !== String(customer)
  ) {
    throw createServiceError(
      "Attribution customer does not match the canonical customer linked to the lead.",
      409,
      { code: "ATTRIBUTION_SUBJECT_MISMATCH" }
    );
  }
}

export async function resolveCampaignAttribution(
  payload = {},
  {
    businessId,
  } = {}
) {
  objectId(businessId, "business");
  const explicitCampaign = identifier(payload.campaign || payload.campaignId);
  if (explicitCampaign) {
    return campaignForBusiness(explicitCampaign, businessId);
  }

  const utm = normaliseUtm(payload);
  const campaignKey = slug(payload.campaignKey);
  const campaignName = text(payload.campaignName || payload.sourceCampaign || utm.campaign);

  const alternatives = [];
  if (campaignKey) alternatives.push({ campaignKey });
  if (utm.campaign) alternatives.push({ "utm.campaign": utm.campaign });
  if (campaignName) alternatives.push({ name: campaignName });

  if (alternatives.length === 0) return null;

  const matches = await Campaign.find({
    business: businessId,
    $or: alternatives,
  })
    .limit(3)
    .lean();

  if (matches.length > 1) {
    throw createServiceError(
      "Campaign attribution is ambiguous; provide a canonical campaign id or key.",
      409,
      { code: "CAMPAIGN_ATTRIBUTION_AMBIGUOUS" }
    );
  }
  return matches[0] || null;
}

export async function createCampaignExecution(
  campaignId,
  payload = {},
  {
    businessId,
    locationId,
    actorUser = null,
  } = {}
) {
  locationAuthority(businessId, locationId);
  const campaign = await campaignForBusiness(campaignId, businessId);
  const channel = lower(payload.channel || campaign.channel);
  const provider = lower(payload.provider);
  if (!channel || !provider) {
    throw createServiceError("Campaign execution requires channel and provider.", 400);
  }

  const allowedChannels = new Set(
    [campaign.channel, ...(campaign.channels || [])]
      .map(lower)
      .filter(Boolean)
  );
  if (allowedChannels.size > 0 && !allowedChannels.has(channel)) {
    throw createServiceError(
      "Execution channel is not enabled on the master campaign.",
      409,
      { code: "CAMPAIGN_CHANNEL_NOT_ENABLED" }
    );
  }

  const scheduledFor = date(payload.scheduledFor, "scheduledFor");
  const idempotencyKey = text(payload.idempotencyKey) || stableKey([
    businessId,
    locationId,
    campaign._id,
    channel,
    provider,
    payload.externalReference,
    scheduledFor?.toISOString() || "draft",
  ]);

  const execution = await CampaignExecution.findOneAndUpdate(
    {
      business: businessId,
      location: locationId,
      idempotencyKey,
    },
    {
      $setOnInsert: {
        business: businessId,
        location: locationId,
        campaign: campaign._id,
        channel,
        provider,
        status: lower(payload.status || "draft"),
        idempotencyKey,
        externalReference: text(payload.externalReference),
        scheduledFor,
        metrics: {
          attempted: 0,
          delivered: 0,
          failed: 0,
          opens: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
          currency: text(payload.currency || "GBP").toUpperCase(),
        },
        metadata: payload.metadata || {},
        createdBy: objectId(actorUser, "actorUser", { optional: true }),
        updatedBy: objectId(actorUser, "actorUser", { optional: true }),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return execution;
}

export async function listCampaignExecutions(
  campaignId,
  query = {},
  {
    businessId,
    locationId,
  } = {}
) {
  locationAuthority(businessId, locationId);
  await campaignForBusiness(campaignId, businessId);
  const match = {
    business: businessId,
    location: locationId,
    campaign: campaignId,
  };
  if (query.status) match.status = lower(query.status);
  if (query.channel) match.channel = lower(query.channel);
  if (query.provider) match.provider = lower(query.provider);

  return CampaignExecution.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(500, Number(query.limit) || 100)))
    .lean();
}

export async function recordAttributionTouch(
  payload = {},
  {
    businessId,
    locationId,
  } = {}
) {
  locationAuthority(businessId, locationId);
  const campaign = await resolveCampaignAttribution(payload, { businessId });
  const lead = objectId(payload.lead || payload.leadId, "lead", { optional: true });
  const customer = objectId(payload.customer || payload.customerId, "customer", { optional: true });
  const opportunity = objectId(payload.opportunity || payload.opportunityId, "opportunity", { optional: true });
  const externalReference = text(payload.externalReference);

  if (!lead && !customer && !opportunity && !externalReference) {
    throw createServiceError(
      "Attribution touch requires a lead, customer, opportunity or external reference.",
      400
    );
  }

  await validateAttributionSubjects(
    { lead, customer, opportunity },
    businessId,
    locationId
  );

  const utm = normaliseUtm(payload);
  const occurredAt = date(payload.occurredAt, "occurredAt") || new Date();
  const touchType = lower(payload.touchType || "interaction").replaceAll("-", "_");
  const channel = lower(payload.channel || payload.sourceChannel || "other");
  const sourceSystem = lower(payload.sourceSystem || payload.system);
  const medium = lower(payload.medium || payload.sourceMedium || utm.medium);
  const sourceKey = text(payload.sourceKey) || stableKey([
    businessId,
    locationId,
    campaign?._id,
    lead,
    customer,
    opportunity,
    touchType,
    channel,
    sourceSystem,
    externalReference,
    utm.campaign,
  ]);

  const existing = await AttributionTouch.findOne({
    business: businessId,
    location: locationId,
    sourceKey,
  }).lean();
  if (existing) return existing;

  const document = {
    business: businessId,
    location: locationId,
    campaign: campaign?._id || null,
    lead,
    customer,
    opportunity,
    touchType,
    channel,
    sourceSystem,
    medium,
    externalReference,
    sourceKey,
    utm,
    occurredAt,
    metadata: payload.metadata || {},
  };

  try {
    const created = await AttributionTouch.create(document);
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      return AttributionTouch.findOne({
        business: businessId,
        location: locationId,
        sourceKey,
      }).lean();
    }
    throw error;
  }
}

export async function recordLeadCaptureAttribution(
  lead,
  payload = {},
  {
    businessId,
    locationId,
  } = {}
) {
  if (!lead?._id) return null;
  if (String(lead.location || "") !== String(locationId || "")) {
    throw createServiceError("Lead attribution must use the selected location.", 409, {
      code: "ATTRIBUTION_LOCATION_MISMATCH",
    });
  }
  const source = lead.source || payload.source || {};
  return recordAttributionTouch(
    {
      lead: lead._id,
      customer: lead.customer || null,
      touchType: "lead_capture",
      channel: source.channel || payload.sourceChannel,
      sourceSystem: source.system || payload.sourceSystem,
      sourceMedium: source.medium || payload.sourceMedium,
      sourceCampaign: source.campaign || payload.sourceCampaign,
      externalReference: source.externalReference || payload.externalReference,
      campaign: payload.campaignId || payload.campaign,
      campaignKey: payload.campaignKey,
      utm: payload.utm,
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
      utmTerm: payload.utmTerm,
      utmContent: payload.utmContent,
      sourceKey: stableKey([businessId, locationId, lead._id, "lead_capture"]),
      metadata: {
        origin: "lead_capture",
      },
    },
    { businessId, locationId }
  );
}

export async function recordLeadConversionAttribution(
  lead,
  customer,
  {
    businessId,
    locationId,
  } = {}
) {
  if (!lead?._id || !customer?._id) return null;
  if (String(lead.location || "") !== String(locationId || "")) {
    throw createServiceError("Lead conversion attribution must use the selected location.", 409, {
      code: "ATTRIBUTION_LOCATION_MISMATCH",
    });
  }
  return recordAttributionTouch(
    {
      lead: lead._id,
      customer: customer._id,
      touchType: "conversion",
      channel: lead.source?.channel || "other",
      sourceSystem: lead.source?.system || "",
      sourceMedium: lead.source?.medium || "",
      sourceCampaign: lead.source?.campaign || "",
      externalReference: lead.source?.externalReference || "",
      sourceKey: stableKey([businessId, locationId, lead._id, customer._id, "conversion"]),
      metadata: {
        origin: "lead_conversion",
      },
    },
    { businessId, locationId }
  );
}

export async function attributionForLead(
  leadId,
  {
    businessId,
    locationId,
  } = {}
) {
  objectId(leadId, "lead");
  locationAuthority(businessId, locationId);
  const lead = await Lead.findOne({
    _id: leadId,
    business: businessId,
    location: locationId,
  })
    .select("_id")
    .lean();
  if (!lead) {
    throw createServiceError("Lead not found in the selected location.", 404);
  }

  const touches = await AttributionTouch.find({
    business: businessId,
    location: locationId,
    lead: leadId,
  })
    .populate("campaign", "campaignKey name objective channel channels utm status")
    .sort({ occurredAt: 1, _id: 1 })
    .lean();

  const conversionIndex = touches.findIndex((touch) => touch.touchType === "conversion");
  const eligible = conversionIndex >= 0 ? touches.slice(0, conversionIndex) : touches;
  const firstTouch = eligible[0] || touches[0] || null;
  const lastTouch = eligible[eligible.length - 1] || firstTouch;

  return {
    leadId: String(leadId),
    locationId: String(locationId),
    firstTouch,
    lastTouch,
    conversionTouch: conversionIndex >= 0 ? touches[conversionIndex] : null,
    touchCount: touches.length,
    touches,
  };
}

export default {
  attributionForLead,
  createCampaignExecution,
  listCampaignExecutions,
  recordAttributionTouch,
  recordLeadCaptureAttribution,
  recordLeadConversionAttribution,
  resolveCampaignAttribution,
};
