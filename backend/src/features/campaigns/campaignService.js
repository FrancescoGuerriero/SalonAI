import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import Campaign, { CAMPAIGN_CHANNELS } from "./Campaign.js";
import CommunicationTemplate from "../../models/CommunicationTemplate.js";
import ScheduledCommunication from "../scheduler/ScheduledCommunication.js";
import { getSegment, previewSegment } from "../segments/segmentService.js";
import {
  buildCustomerContext,
  renderTemplate,
} from "../../shared/templateRenderer.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import { userId } from "../../shared/modelHelpers.js";

const SCHEDULED_COMMUNICATION_CHANNELS = new Set([
  "email",
  "sms",
  "whatsapp",
  "phone",
  "in_app",
]);

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function identifier(value) {
  return value?._id || value?.id || value || null;
}

function requireBusinessId(value) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      "A trusted active business is required for campaign operations.",
      400
    );
  }
  return value;
}

function slug(value) {
  return lower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function normaliseUtm(payload = {}, fallbackCampaign = "", current = {}) {
  const supplied = payload.utm && typeof payload.utm === "object" ? payload.utm : {};
  return {
    source: lower(supplied.source ?? payload.utmSource ?? current.source),
    medium: lower(supplied.medium ?? payload.utmMedium ?? current.medium),
    campaign: text(
      supplied.campaign ?? payload.utmCampaign ?? current.campaign ?? fallbackCampaign
    ),
    term: text(supplied.term ?? payload.utmTerm ?? current.term),
    content: text(supplied.content ?? payload.utmContent ?? current.content),
  };
}

function normaliseChannels(primary, values) {
  const channels = [primary, ...(Array.isArray(values) ? values : [])]
    .map(lower)
    .filter(Boolean);
  const unique = [...new Set(channels)];
  const invalid = unique.filter((channel) => !CAMPAIGN_CHANNELS.includes(channel));
  if (invalid.length) {
    throw createServiceError(
      `Unsupported campaign channel: ${invalid.join(", ")}.`,
      400,
      { field: "channels" }
    );
  }
  return unique;
}

function recipientForChannel(customer, channel) {
  if (channel === "email") return customer.email;
  if (["sms", "phone", "whatsapp"].includes(channel)) {
    return customer.phone || customer.phoneNumber || customer.mobile;
  }
  return String(customer._id);
}

async function campaignForBusiness(id, tenantBusinessId) {
  requireBusinessId(tenantBusinessId);
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError("Campaign identifier is invalid.", 400);
  }
  return assertFound(
    await Campaign.findOne({ _id: id, business: tenantBusinessId }),
    "Campaign not found."
  );
}

async function templateForBusiness(id, tenantBusinessId) {
  const templateId = identifier(id);
  if (!templateId) return null;
  if (!mongoose.isValidObjectId(templateId)) {
    throw createServiceError("Communication template identifier is invalid.", 400);
  }
  return assertFound(
    await CommunicationTemplate.findOne({
      _id: templateId,
      $or: [
        { business: tenantBusinessId },
        { business: { $exists: false }, isSystemTemplate: true },
        { business: null, isSystemTemplate: true },
      ],
    }).lean(),
    "Communication template not found in the active business."
  );
}

async function validateAudienceReferences(payload, tenantBusinessId) {
  if (payload.segment) {
    await getSegment(identifier(payload.segment), { businessId: tenantBusinessId });
  }

  if (Array.isArray(payload.recipients) && payload.recipients.length) {
    const ids = [...new Set(payload.recipients.map((value) => String(identifier(value))))];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
      throw createServiceError("Campaign recipients contain an invalid customer identifier.", 400);
    }
    const ownedCount = await Customer.countDocuments({
      _id: { $in: ids },
      business: tenantBusinessId,
      status: { $ne: "deleted" },
    });
    if (ownedCount !== ids.length) {
      throw createServiceError(
        "Every campaign recipient must belong to the active business.",
        409,
        { code: "CAMPAIGN_RECIPIENT_TENANCY_MISMATCH" }
      );
    }
  }
}

async function campaignRecipients(campaign, tenantBusinessId) {
  const recipients = new Map();
  const segmentId = identifier(campaign.segment);

  if (segmentId) {
    const preview = await previewSegment(String(segmentId), {
      limit: 5000,
      businessId: tenantBusinessId,
    });
    for (const customer of preview.customers) {
      recipients.set(String(customer._id), customer);
    }
  }

  if (campaign.recipients?.length) {
    const recipientIds = campaign.recipients
      .map(identifier)
      .filter(Boolean);
    const direct = await Customer.find({
      _id: { $in: recipientIds },
      business: tenantBusinessId,
      status: { $ne: "deleted" },
    })
      .select("firstName lastName fullName name email phone phoneNumber mobile")
      .lean();
    for (const customer of direct) {
      recipients.set(String(customer._id), customer);
    }
  }

  return [...recipients.values()];
}

export async function createCampaign(
  payload,
  user,
  { businessId: tenantBusinessId } = {}
) {
  requireBusinessId(tenantBusinessId);
  const name = text(payload.name);
  if (!name) throw createServiceError("Campaign name is required.", 400);

  const primaryChannel = lower(payload.channel || "email");
  const channels = normaliseChannels(primaryChannel, payload.channels);
  const campaignKey = slug(payload.campaignKey || name);

  if (
    SCHEDULED_COMMUNICATION_CHANNELS.has(primaryChannel) &&
    !text(payload.message) &&
    !payload.template
  ) {
    throw createServiceError("A campaign message or template is required.", 400);
  }

  await validateAudienceReferences(payload, tenantBusinessId);
  const template = await templateForBusiness(payload.template, tenantBusinessId);
  if (template && template.channel !== primaryChannel) {
    throw createServiceError(
      "The communication template channel must match the campaign primary channel.",
      409,
      { code: "CAMPAIGN_TEMPLATE_CHANNEL_MISMATCH" }
    );
  }

  const campaign = await Campaign.create({
    business: tenantBusinessId,
    campaignKey,
    name,
    objective: lower(payload.objective || "general"),
    campaignType: lower(payload.campaignType || "general"),
    channel: primaryChannel,
    channels,
    template: payload.template || undefined,
    segment: payload.segment || undefined,
    recipients: Array.isArray(payload.recipients)
      ? payload.recipients.map(identifier).filter(Boolean)
      : [],
    subject: text(payload.subject),
    message: text(payload.message),
    utm: normaliseUtm(payload, campaignKey),
    startsAt: payload.startsAt || null,
    endsAt: payload.endsAt || null,
    metadata: payload.metadata || {},
    status: "draft",
    createdBy: userId(user),
    updatedBy: userId(user),
  });

  return campaign.toObject();
}

export async function listCampaigns(
  query = {},
  { businessId: tenantBusinessId } = {}
) {
  requireBusinessId(tenantBusinessId);
  const { page, limit, skip } = paginationFromQuery(query);
  const match = { business: tenantBusinessId };
  if (query.status) match.status = lower(query.status);
  if (query.channel) match.channel = lower(query.channel);
  if (query.campaignType) match.campaignType = lower(query.campaignType);
  if (query.objective) match.objective = lower(query.objective);

  const [items, total] = await Promise.all([
    Campaign.find(match)
      .populate({
        path: "template",
        match: {
          $or: [
            { business: tenantBusinessId },
            { business: { $exists: false }, isSystemTemplate: true },
            { business: null, isSystemTemplate: true },
          ],
        },
        select: "name channel campaignType",
      })
      .populate({
        path: "segment",
        match: { business: tenantBusinessId },
        select: "name",
      })
      .populate("createdBy", "name firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Campaign.countDocuments(match),
  ]);

  return { items, pagination: paginationResult(page, limit, total) };
}

export async function getCampaign(id, { businessId: tenantBusinessId } = {}) {
  requireBusinessId(tenantBusinessId);
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError("Campaign identifier is invalid.", 400);
  }
  return assertFound(
    await Campaign.findOne({ _id: id, business: tenantBusinessId })
      .populate({
        path: "template",
        match: {
          $or: [
            { business: tenantBusinessId },
            { business: { $exists: false }, isSystemTemplate: true },
            { business: null, isSystemTemplate: true },
          ],
        },
      })
      .populate({ path: "segment", match: { business: tenantBusinessId } })
      .populate({
        path: "recipients",
        match: { business: tenantBusinessId, status: { $ne: "deleted" } },
        select: "firstName lastName fullName name email phone phoneNumber mobile",
      })
      .lean(),
    "Campaign not found."
  );
}

export async function updateCampaign(
  id,
  payload,
  user,
  { businessId: tenantBusinessId } = {}
) {
  const campaign = await campaignForBusiness(id, tenantBusinessId);
  if (["processing", "completed", "cancelled"].includes(campaign.status)) {
    throw createServiceError(
      `Campaign cannot be edited from status ${campaign.status}.`,
      409
    );
  }

  await validateAudienceReferences(payload, tenantBusinessId);
  const proposedChannel = lower(payload.channel ?? campaign.channel);
  const proposedTemplateId =
    payload.template !== undefined ? payload.template : campaign.template;
  const template = await templateForBusiness(proposedTemplateId, tenantBusinessId);
  if (template && template.channel !== proposedChannel) {
    throw createServiceError(
      "The communication template channel must match the campaign primary channel.",
      409,
      { code: "CAMPAIGN_TEMPLATE_CHANNEL_MISMATCH" }
    );
  }

  for (const field of [
    "name",
    "template",
    "segment",
    "subject",
    "message",
    "startsAt",
    "endsAt",
    "metadata",
  ]) {
    if (payload[field] !== undefined) campaign[field] = payload[field];
  }
  if (payload.recipients !== undefined) {
    campaign.recipients = Array.isArray(payload.recipients)
      ? payload.recipients.map(identifier).filter(Boolean)
      : [];
  }
  if (payload.campaignType !== undefined) campaign.campaignType = lower(payload.campaignType);
  if (payload.objective !== undefined) campaign.objective = lower(payload.objective);
  if (payload.channel !== undefined) campaign.channel = proposedChannel;

  if (payload.campaignKey !== undefined || payload.name !== undefined) {
    campaign.campaignKey = slug(payload.campaignKey || campaign.name);
  }
  if (payload.channels !== undefined || payload.channel !== undefined) {
    campaign.channels = normaliseChannels(
      campaign.channel,
      payload.channels ?? campaign.channels
    );
  }
  if (
    payload.utm !== undefined ||
    payload.utmSource !== undefined ||
    payload.utmMedium !== undefined ||
    payload.utmCampaign !== undefined ||
    payload.utmTerm !== undefined ||
    payload.utmContent !== undefined
  ) {
    campaign.utm = normaliseUtm(
      payload,
      campaign.campaignKey,
      campaign.utm?.toObject?.() || campaign.utm || {}
    );
  }

  if (
    SCHEDULED_COMMUNICATION_CHANNELS.has(campaign.channel) &&
    !text(campaign.message) &&
    !campaign.template
  ) {
    throw createServiceError("A campaign message or template is required.", 400);
  }

  campaign.updatedBy = userId(user);
  await campaign.save();
  return campaign.toObject();
}

export async function previewCampaign(id, { businessId: tenantBusinessId } = {}) {
  const campaign = await getCampaign(id, { businessId: tenantBusinessId });
  const recipients = await campaignRecipients(campaign, tenantBusinessId);
  const template = campaign.template?._id ? campaign.template : null;

  const examples = recipients.slice(0, 10).map((customer) => {
    const context = buildCustomerContext(customer);
    return {
      customer,
      recipient: recipientForChannel(customer, campaign.channel),
      subject: renderTemplate(template?.subject || campaign.subject, context),
      message: renderTemplate(template?.body || campaign.message, context),
    };
  });

  return {
    campaign,
    recipientCount: recipients.filter((customer) =>
      recipientForChannel(customer, campaign.channel)
    ).length,
    examples,
  };
}

export async function scheduleCampaign(
  id,
  scheduledFor,
  { businessId: tenantBusinessId } = {}
) {
  const campaign = await campaignForBusiness(id, tenantBusinessId);
  if (["processing", "completed", "cancelled"].includes(campaign.status)) {
    throw createServiceError(
      `Campaign cannot be scheduled from status ${campaign.status}.`,
      409
    );
  }
  if (!SCHEDULED_COMMUNICATION_CHANNELS.has(campaign.channel)) {
    throw createServiceError(
      "This campaign channel must be scheduled through a governed provider execution.",
      409,
      { code: "CAMPAIGN_CHANNEL_REQUIRES_PROVIDER_EXECUTION" }
    );
  }

  const runAt = new Date(scheduledFor || campaign.scheduledFor);
  if (Number.isNaN(runAt.getTime())) {
    throw createServiceError("A valid scheduledFor date is required.", 400);
  }

  const recipients = await campaignRecipients(campaign, tenantBusinessId);
  if (!recipients.length) {
    throw createServiceError("The campaign has no matching recipients.", 400);
  }

  const template = campaign.template
    ? await templateForBusiness(campaign.template, tenantBusinessId)
    : null;
  const jobs = [];

  for (const customer of recipients) {
    const recipient = recipientForChannel(customer, campaign.channel);
    if (!recipient) continue;
    const context = buildCustomerContext(customer);
    jobs.push({
      business: tenantBusinessId,
      campaign: campaign._id,
      customer: customer._id,
      communicationType: "campaign",
      channel: campaign.channel,
      recipient,
      subject: renderTemplate(template?.subject || campaign.subject, context),
      message: renderTemplate(template?.body || campaign.message, context),
      scheduledFor: runAt,
      status: "queued",
      metadata: {
        campaignType: campaign.campaignType,
        campaignKey: campaign.campaignKey,
        objective: campaign.objective,
      },
    });
  }

  await ScheduledCommunication.deleteMany({
    business: tenantBusinessId,
    campaign: campaign._id,
    status: "queued",
  });
  if (jobs.length) await ScheduledCommunication.insertMany(jobs, { ordered: false });

  campaign.status = "scheduled";
  campaign.scheduledFor = runAt;
  campaign.recipientCount = jobs.length;
  campaign.sentCount = 0;
  campaign.failedCount = 0;
  await campaign.save();

  return getCampaign(campaign._id, { businessId: tenantBusinessId });
}

export async function cancelCampaign(id, { businessId: tenantBusinessId } = {}) {
  const campaign = await campaignForBusiness(id, tenantBusinessId);
  if (campaign.status === "completed") {
    throw createServiceError("A completed campaign cannot be cancelled.", 409);
  }

  campaign.status = "cancelled";
  await campaign.save();
  await ScheduledCommunication.updateMany(
    {
      business: tenantBusinessId,
      campaign: campaign._id,
      status: { $in: ["queued", "processing"] },
    },
    { $set: { status: "cancelled", lockedAt: null, lockedBy: "" } }
  );
  return campaign.toObject();
}

export async function campaignJobs(
  id,
  query = {},
  { businessId: tenantBusinessId } = {}
) {
  const campaign = await campaignForBusiness(id, tenantBusinessId);
  const { page, limit, skip } = paginationFromQuery(query);
  const match = {
    business: tenantBusinessId,
    campaign: campaign._id,
  };
  if (query.status) match.status = lower(query.status);

  const [items, total] = await Promise.all([
    ScheduledCommunication.find(match)
      .populate({
        path: "customer",
        match: { business: tenantBusinessId, status: { $ne: "deleted" } },
        select: "firstName lastName fullName name email phone phoneNumber mobile",
      })
      .sort({ scheduledFor: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ScheduledCommunication.countDocuments(match),
  ]);

  return { items, pagination: paginationResult(page, limit, total) };
}
