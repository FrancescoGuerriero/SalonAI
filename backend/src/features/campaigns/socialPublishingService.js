import { createHash } from "node:crypto";
import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import Campaign from "./Campaign.js";
import CampaignExecution from "./CampaignExecution.js";
import SocialPublication, { SOCIAL_CHANNELS } from "./SocialPublication.js";
import { createCampaignExecution } from "./growthCampaignService.js";
import { publishSocialProvider } from "./socialProviderAdapters.js";
import { createServiceError } from "../../shared/serviceError.js";

const PROVIDERS_BY_CHANNEL = Object.freeze({
  facebook: new Set(["facebook", "meta", "meta_graph"]),
  instagram: new Set(["instagram", "meta", "meta_graph"]),
  linkedin: new Set(["linkedin"]),
  google_business_profile: new Set([
    "google_business_profile",
    "google_business",
    "gbp",
  ]),
});

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
  const id = identifier(value);
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return id;
}

function date(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function stableKey(parts) {
  return createHash("sha256")
    .update(parts.map((part) => text(part)).join(":"))
    .digest("hex");
}

function livePublishingEnabled() {
  return lower(process.env.SOCIAL_PUBLISHING_LIVE_ENABLED) === "true";
}

function contentFromPayload(payload = {}) {
  const supplied = payload.content && typeof payload.content === "object"
    ? payload.content
    : {};
  return {
    text: text(supplied.text ?? payload.text),
    linkUrl: text(supplied.linkUrl ?? payload.linkUrl),
    mediaUrl: text(supplied.mediaUrl ?? payload.mediaUrl),
    mediaType: lower(supplied.mediaType ?? payload.mediaType ?? "none"),
    altText: text(supplied.altText ?? payload.altText),
    languageCode: text(supplied.languageCode ?? payload.languageCode ?? "en-GB"),
  };
}

async function campaignForBusiness(campaignId, businessId) {
  objectId(campaignId, "campaign");
  objectId(businessId, "business");
  const campaign = await Campaign.findOne({
    _id: campaignId,
    business: businessId,
  });
  if (!campaign) {
    throw createServiceError("Campaign not found in the active business.", 404);
  }
  return campaign;
}

async function connectionForBusiness(connectionId, businessId, channel) {
  objectId(connectionId, "connection");
  const connection = await IntegrationConnection.findOne({
    _id: connectionId,
    business: businessId,
    status: { $in: ["connected", "degraded"] },
  });
  if (!connection) {
    throw createServiceError(
      "Social provider connection is not connected in the active business.",
      409,
      { code: "SOCIAL_PROVIDER_CONNECTION_NOT_READY" }
    );
  }

  const acceptedProviders = PROVIDERS_BY_CHANNEL[channel];
  if (!acceptedProviders?.has(lower(connection.provider))) {
    throw createServiceError(
      "Social provider connection does not match the requested publication channel.",
      409,
      { code: "SOCIAL_PROVIDER_CHANNEL_MISMATCH" }
    );
  }
  return connection;
}

function validateContent(channel, content) {
  if (!SOCIAL_CHANNELS.includes(channel)) {
    throw createServiceError(`Unsupported social publication channel: ${channel}.`, 400);
  }
  if (!content.text && !content.mediaUrl && !content.linkUrl) {
    throw createServiceError("A social publication requires text, media or a link.", 400);
  }
  if (channel === "instagram" && !content.mediaUrl) {
    throw createServiceError("Instagram publication requires media.", 400, {
      code: "INSTAGRAM_MEDIA_REQUIRED",
    });
  }
  if (!["none", "image", "video", "document"].includes(content.mediaType)) {
    throw createServiceError("Unsupported social publication media type.", 400, {
      field: "mediaType",
    });
  }
  if (content.mediaType !== "none" && !content.mediaUrl) {
    throw createServiceError("mediaUrl is required when a media type is selected.", 400, {
      field: "mediaUrl",
    });
  }
}

export async function createSocialPublication(
  campaignId,
  payload = {},
  {
    businessId,
    actorUser = null,
  } = {}
) {
  const campaign = await campaignForBusiness(campaignId, businessId);
  const channel = lower(payload.channel);
  const allowedChannels = new Set(
    [campaign.channel, ...(campaign.channels || [])].map(lower).filter(Boolean)
  );
  if (!SOCIAL_CHANNELS.includes(channel) || !allowedChannels.has(channel)) {
    throw createServiceError(
      "Social publication channel is not enabled on the master campaign.",
      409,
      { code: "CAMPAIGN_CHANNEL_NOT_ENABLED" }
    );
  }

  const connection = await connectionForBusiness(payload.connection, businessId, channel);
  const content = contentFromPayload(payload);
  validateContent(channel, content);
  const scheduledFor = date(payload.scheduledFor, "scheduledFor");
  const requestedKey = text(payload.idempotencyKey);
  const idempotencyKey = requestedKey || stableKey([
    businessId,
    campaign._id,
    channel,
    connection._id,
    content.text,
    content.linkUrl,
    content.mediaUrl,
    scheduledFor?.toISOString() || "draft",
  ]);

  const execution = await createCampaignExecution(
    campaign._id,
    {
      channel,
      provider: connection.provider,
      status: "draft",
      idempotencyKey: `social:${idempotencyKey}`,
      scheduledFor,
      currency: payload.currency || "GBP",
      metadata: {
        source: "social_publication",
        connectionId: String(connection._id),
      },
    },
    { businessId, actorUser }
  );

  const publication = await SocialPublication.findOneAndUpdate(
    { business: businessId, idempotencyKey },
    {
      $setOnInsert: {
        business: businessId,
        campaign: campaign._id,
        campaignExecution: execution._id,
        connection: connection._id,
        channel,
        provider: connection.provider,
        content,
        status: scheduledFor ? "scheduled" : "draft",
        scheduledFor,
        idempotencyKey,
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

  return publication;
}

export async function listSocialPublications(
  campaignId,
  query = {},
  { businessId } = {}
) {
  const campaign = await campaignForBusiness(campaignId, businessId);
  const match = {
    business: businessId,
    campaign: campaign._id,
  };
  if (query.status) match.status = lower(query.status);
  if (query.channel) match.channel = lower(query.channel);
  if (query.provider) match.provider = lower(query.provider);

  return SocialPublication.find(match)
    .populate("connection", "provider connectionKey status metadata")
    .populate("campaignExecution", "status provider metrics scheduledFor completedAt")
    .sort({ scheduledFor: 1, createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(500, Number(query.limit) || 100)))
    .lean();
}

export async function queueSocialPublication(
  campaignId,
  publicationId,
  {
    businessId,
    actorUser = null,
  } = {}
) {
  await campaignForBusiness(campaignId, businessId);
  objectId(publicationId, "publication");
  const publication = await SocialPublication.findOne({
    _id: publicationId,
    campaign: campaignId,
    business: businessId,
  });
  if (!publication) throw createServiceError("Social publication not found.", 404);
  if (!["draft", "scheduled", "failed"].includes(publication.status)) {
    throw createServiceError(
      `Social publication cannot be queued from status ${publication.status}.`,
      409
    );
  }
  publication.status = publication.scheduledFor && publication.scheduledFor > new Date()
    ? "scheduled"
    : "queued";
  publication.updatedBy = objectId(actorUser, "actorUser", { optional: true });
  publication.lastError = { code: "", message: "", at: null };
  await publication.save();

  await CampaignExecution.updateOne(
    {
      _id: publication.campaignExecution,
      campaign: campaignId,
      business: businessId,
    },
    {
      $set: {
        status: publication.status === "queued" ? "queued" : "draft",
        scheduledFor: publication.scheduledFor || null,
        updatedBy: objectId(actorUser, "actorUser", { optional: true }),
      },
    }
  );

  return publication.toObject();
}

export async function publishSocialPublication(
  campaignId,
  publicationId,
  {
    businessId,
    actorUser = null,
  } = {}
) {
  if (!livePublishingEnabled()) {
    throw createServiceError(
      "Live social publishing is disabled until the controlled provider activation step is approved.",
      409,
      { code: "SOCIAL_PUBLISHING_LIVE_DISABLED" }
    );
  }

  await campaignForBusiness(campaignId, businessId);
  objectId(publicationId, "publication");
  const publication = await SocialPublication.findOne({
    _id: publicationId,
    campaign: campaignId,
    business: businessId,
  });
  if (!publication) throw createServiceError("Social publication not found.", 404);
  if (!["queued", "scheduled", "failed"].includes(publication.status)) {
    throw createServiceError(
      `Social publication cannot be published from status ${publication.status}.`,
      409
    );
  }
  if (publication.scheduledFor && publication.scheduledFor > new Date()) {
    throw createServiceError("Social publication is not due yet.", 409, {
      code: "SOCIAL_PUBLICATION_NOT_DUE",
    });
  }

  const connection = await connectionForBusiness(
    publication.connection,
    businessId,
    publication.channel
  );
  publication.status = "publishing";
  publication.attemptCount += 1;
  publication.lastAttemptAt = new Date();
  publication.updatedBy = objectId(actorUser, "actorUser", { optional: true });
  await publication.save();

  await CampaignExecution.updateOne(
    {
      _id: publication.campaignExecution,
      business: businessId,
      campaign: campaignId,
    },
    {
      $set: {
        status: "running",
        startedAt: publication.lastAttemptAt,
        updatedBy: objectId(actorUser, "actorUser", { optional: true }),
      },
      $inc: { "metrics.attempted": 1 },
    }
  );

  try {
    const result = await publishSocialProvider(connection, publication.toObject());
    const now = new Date();
    publication.status = "published";
    publication.externalPostId = result.externalPostId || "";
    publication.externalPostUrl = result.externalPostUrl || "";
    publication.providerMetadata = result.providerMetadata || {};
    publication.publishedAt = now;
    publication.lastError = { code: "", message: "", at: null };
    await publication.save();

    await CampaignExecution.updateOne(
      {
        _id: publication.campaignExecution,
        business: businessId,
        campaign: campaignId,
      },
      {
        $set: {
          status: "succeeded",
          completedAt: now,
          externalReference: publication.externalPostId,
          updatedBy: objectId(actorUser, "actorUser", { optional: true }),
        },
        $inc: { "metrics.delivered": 1 },
      }
    );
    return publication.toObject();
  } catch (error) {
    const now = new Date();
    publication.status = "failed";
    publication.lastError = {
      code: text(error.code || "SOCIAL_PROVIDER_PUBLISH_FAILED").slice(0, 200),
      message: text(error.message).slice(0, 2000),
      at: now,
    };
    await publication.save();

    await CampaignExecution.updateOne(
      {
        _id: publication.campaignExecution,
        business: businessId,
        campaign: campaignId,
      },
      {
        $set: {
          status: "failed",
          completedAt: now,
          updatedBy: objectId(actorUser, "actorUser", { optional: true }),
        },
        $inc: { "metrics.failed": 1 },
      }
    );
    throw error;
  }
}

export function socialPublishingStatus() {
  return {
    liveEnabled: livePublishingEnabled(),
    supportedChannels: [...SOCIAL_CHANNELS],
  };
}

export default {
  createSocialPublication,
  listSocialPublications,
  publishSocialPublication,
  queueSocialPublication,
  socialPublishingStatus,
};
