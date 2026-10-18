import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";
import MessageDelivery from "../models/MessageDelivery.js";

import {
  createCommunicationCampaign,
  getCommunicationCampaign,
} from "../services/communicationCampaignService.js";
import {
  createCommunicationTemplate,
  getCommunicationTemplate,
} from "../services/communicationTemplateService.js";
import {
  deliverAndRecordMessage,
  retryDeliveryRecord,
} from "../services/messageDeliveryRecordService.js";
import {
  communicationAggregateAuthorityFilter,
  sanitizeCommunicationPayload,
  trustedCommunicationOwnership,
} from "../services/communicationEffectiveAuthorityService.js";

const MAX_BATCH_SIZE = 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function text(value) {
  return String(value ?? "").trim();
}

function integer(value, fallback, maximum = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalised = text(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off"].includes(normalised)) return false;
  return fallback;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function combineScope(scopeFilter, filter = {}) {
  return {
    $and: [scopeFilter, filter],
  };
}

function campaignFilter(query = {}) {
  const filter = {};
  const search = text(query.search);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: expression },
      { description: expression },
      { subject: expression },
      { body: expression },
    ];
  }
  if (query.status) filter.status = text(query.status);
  if (query.campaignType) filter.campaignType = text(query.campaignType);
  if (query.channel) filter.channel = text(query.channel);
  if (query.sendMode) filter["schedule.mode"] = text(query.sendMode);
  if (query.createdBy) filter.createdBy = query.createdBy;

  const createdAt = {};
  if (query.startDate) {
    const start = new Date(query.startDate);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }
  if (query.endDate) {
    const end = new Date(query.endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
  }
  if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;
  return filter;
}

function templateFilter(query = {}) {
  const filter = {};
  const search = text(query.search);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: expression },
      { description: expression },
      { subject: expression },
      { body: expression },
      { tags: expression },
    ];
  }
  if (query.campaignType) filter.campaignType = text(query.campaignType);
  if (query.channel) filter.channel = text(query.channel);
  if (query.createdBy) filter.createdBy = query.createdBy;
  if (query.tag) filter.tags = text(query.tag).toLowerCase();
  if (query.active !== undefined) {
    filter.active = booleanValue(query.active, true);
  }
  if (query.isSystemTemplate !== undefined) {
    filter.isSystemTemplate = booleanValue(query.isSystemTemplate, false);
  }
  return filter;
}

function deliveryFilter(query = {}) {
  const filter = {};
  if (query.campaignId) filter.campaign = query.campaignId;
  if (query.customerId) filter.customer = query.customerId;
  if (query.channel) filter.channel = text(query.channel).toLowerCase();
  if (query.status) filter.status = text(query.status).toLowerCase();
  if (query.provider) filter.provider = text(query.provider).toLowerCase();
  if (query.mode) filter.mode = text(query.mode).toLowerCase();
  if (query.retryable !== undefined) {
    filter["retry.retryable"] = booleanValue(query.retryable, false);
  }
  const createdAt = {};
  if (query.createdFrom) {
    const from = new Date(query.createdFrom);
    if (!Number.isNaN(from.getTime())) createdAt.$gte = from;
  }
  if (query.createdTo) {
    const to = new Date(query.createdTo);
    if (!Number.isNaN(to.getTime())) createdAt.$lte = to;
  }
  if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

  const search = text(query.search);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { deliveryId: expression },
      { providerMessageId: expression },
      { "recipient.email": expression },
      { "recipient.phone": expression },
      { "recipient.name": expression },
    ];
  }
  return filter;
}

function userId(request) {
  return request.user?._id || request.user?.id || null;
}

function requestMetadata(request, metadata = {}) {
  const safeMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  return {
    ...safeMetadata,
    request: {
      ipAddress:
        text(request.headers?.["x-forwarded-for"]).split(",")[0].trim() ||
        request.ip ||
        request.socket?.remoteAddress ||
        "",
      userAgent: text(request.headers?.["user-agent"]),
      requestedAt: new Date().toISOString(),
    },
  };
}

async function stampOwnership(Model, id, request) {
  const ownership = trustedCommunicationOwnership(request.communicationScope);
  await Model.updateOne(
    { _id: id },
    {
      $set: {
        business: ownership.business,
        location: ownership.location || null,
      },
    }
  );
}

export async function createScopedCampaign(request, response, next) {
  try {
    const payload = sanitizeCommunicationPayload(request.body || {});
    const campaign = await createCommunicationCampaign(payload, request.user);
    await stampOwnership(CommunicationCampaign, campaign._id, request);
    const ownedCampaign = await getCommunicationCampaign(campaign._id);
    return response.status(201).json({
      success: true,
      message: "Communication campaign created successfully.",
      campaign: ownedCampaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listScopedCampaigns(request, response, next) {
  try {
    const page = integer(request.query.page, 1, 100000);
    const limit = integer(request.query.limit, 12, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, campaignFilter(request.query));
    const [campaigns, total] = await Promise.all([
      CommunicationCampaign.find(match)
        .populate("template", "name slug channel campaignType active")
        .populate("createdBy", "name firstName lastName email")
        .populate("updatedBy", "name firstName lastName email")
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      CommunicationCampaign.countDocuments(match),
    ]);
    return response.status(200).json({
      success: true,
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScopedCampaignSummary(request, response, next) {
  try {
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, campaignFilter(request.query));
    const [statusRows, channelRows, typeRows, total, upcomingScheduled] =
      await Promise.all([
        CommunicationCampaign.aggregate([
          { $match: match },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        CommunicationCampaign.aggregate([
          { $match: match },
          { $group: { _id: "$channel", count: { $sum: 1 } } },
        ]),
        CommunicationCampaign.aggregate([
          { $match: match },
          { $group: { _id: "$campaignType", count: { $sum: 1 } } },
        ]),
        CommunicationCampaign.countDocuments(match),
        CommunicationCampaign.find(
          combineScope(scope, {
            status: "scheduled",
            "schedule.scheduledAt": { $gte: new Date() },
          })
        )
          .sort({ "schedule.scheduledAt": 1 })
          .limit(10)
          .lean(),
      ]);

    const toMap = (rows) =>
      Object.fromEntries(rows.map((row) => [String(row._id || "unknown"), row.count]));

    return response.status(200).json({
      success: true,
      summary: { total },
      byStatus: toMap(statusRows),
      byChannel: toMap(channelRows),
      byCampaignType: toMap(typeRows),
      upcomingScheduled,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createScopedTemplate(request, response, next) {
  try {
    const payload = sanitizeCommunicationPayload(request.body || {});
    const template = await createCommunicationTemplate(payload, request.user);
    await stampOwnership(CommunicationTemplate, template._id, request);
    const ownedTemplate = await getCommunicationTemplate(template._id);
    return response.status(201).json({
      success: true,
      message: "Communication template created successfully.",
      template: ownedTemplate,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listScopedTemplates(request, response, next) {
  try {
    const page = integer(request.query.page, 1, 100000);
    const limit = integer(request.query.limit, 12, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, templateFilter(request.query));
    const [templates, total] = await Promise.all([
      CommunicationTemplate.find(match)
        .populate("createdBy", "name firstName lastName email")
        .populate("updatedBy", "name firstName lastName email")
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      CommunicationTemplate.countDocuments(match),
    ]);
    return response.status(200).json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScopedTemplateSummary(request, response, next) {
  try {
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, templateFilter(request.query));
    const [total, active, channels, campaignTypes] = await Promise.all([
      CommunicationTemplate.countDocuments(match),
      CommunicationTemplate.countDocuments(combineScope(scope, { ...templateFilter(request.query), active: true })),
      CommunicationTemplate.aggregate([
        { $match: match },
        { $group: { _id: "$channel", count: { $sum: 1 } } },
      ]),
      CommunicationTemplate.aggregate([
        { $match: match },
        { $group: { _id: "$campaignType", count: { $sum: 1 } } },
      ]),
    ]);
    return response.status(200).json({
      success: true,
      summary: {
        total,
        active,
        inactive: Math.max(0, total - active),
        channels: Object.fromEntries(channels.map((row) => [String(row._id || "unknown"), row.count])),
        campaignTypes: Object.fromEntries(campaignTypes.map((row) => [String(row._id || "unknown"), row.count])),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listScopedDeliveries(request, response, next) {
  try {
    const page = integer(request.query.page, 1, 100000);
    const limit = integer(request.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, deliveryFilter(request.query));
    const sortDirection = text(request.query.sortDirection).toLowerCase() === "asc" ? 1 : -1;
    const [deliveries, total] = await Promise.all([
      MessageDelivery.find(match)
        .sort({ createdAt: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      MessageDelivery.countDocuments(match),
    ]);
    return response.status(200).json({
      success: true,
      message: "Message-delivery records retrieved successfully.",
      deliveries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScopedCampaignDeliverySummary(request, response, next) {
  try {
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combineScope(scope, { campaign: request.params.campaignId });
    const rows = await MessageDelivery.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusCounts = rows.map((row) => ({ status: row._id, count: row.count }));
    const total = statusCounts.reduce((sum, row) => sum + row.count, 0);
    return response.status(200).json({
      success: true,
      message: "Campaign delivery summary retrieved successfully.",
      summary: { total, statusCounts },
    });
  } catch (error) {
    return next(error);
  }
}

async function deliverScopedMessage(request, message, index = null) {
  const safeMessage = sanitizeCommunicationPayload(message || {});
  const ownership = trustedCommunicationOwnership(request.communicationScope);
  const actor = userId(request);
  const metadata = requestMetadata(request, {
    ...safeMessage.metadata,
    ...(index === null ? {} : { batchIndex: index }),
  });

  const result = await deliverAndRecordMessage(
    {
      ...safeMessage,
      metadata,
      createdBy: actor,
      updatedBy: actor,
    },
    {
      campaignId: safeMessage.campaignId,
      customerId: safeMessage.customerId,
      maximumAttempts: safeMessage.maximumAttempts,
      retryDelayMs: safeMessage.retryDelayMs,
      deferRetries: booleanValue(safeMessage.deferRetries, false),
      consent: safeMessage.consent,
      createdBy: actor,
      updatedBy: actor,
      metadata,
    }
  );

  const deliveryId = result?.delivery?._id;
  if (deliveryId) {
    await MessageDelivery.updateOne(
      { _id: deliveryId },
      {
        $set: {
          business: ownership.business,
          location: ownership.location || null,
        },
      }
    );
    result.delivery = await MessageDelivery.findById(deliveryId);
  }
  return result;
}

export async function sendScopedMessage(request, response, next) {
  try {
    const result = await deliverScopedMessage(request, request.body || {});
    return response.status(result.skipped ? 202 : 201).json({
      success: result.success,
      skipped: Boolean(result.skipped),
      deferred: Boolean(result.deferred),
      message: result.skipped
        ? "Message delivery was skipped because valid consent was not recorded."
        : result.deferred
          ? "Message delivery failed and has been scheduled for retry."
          : "Message delivered and recorded successfully.",
      delivery: result.delivery,
      result: result.result || null,
      retryAt: result.retryAt || null,
    });
  } catch (error) {
    return next(error);
  }
}

export async function sendScopedMessageBatch(request, response, next) {
  try {
    const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];
    if (messages.length === 0 || messages.length > MAX_BATCH_SIZE) {
      const error = new Error(
        messages.length === 0
          ? "The message batch cannot be empty."
          : `The message batch cannot contain more than ${MAX_BATCH_SIZE} messages.`
      );
      error.statusCode = 400;
      error.code = messages.length === 0 ? "EMPTY_MESSAGE_BATCH" : "MESSAGE_BATCH_TOO_LARGE";
      throw error;
    }

    const results = [];
    for (let index = 0; index < messages.length; index += 1) {
      try {
        const result = await deliverScopedMessage(request, messages[index], index);
        results.push({ success: true, index, result });
      } catch (error) {
        results.push({
          success: false,
          index,
          error: {
            message: error.message,
            code: error.code || "MESSAGE_DELIVERY_FAILED",
            statusCode: error.statusCode || 500,
          },
        });
        if (booleanValue(request.body?.stopOnError, false)) break;
      }
    }

    const failed = results.filter((item) => !item.success).length;
    const batch = {
      success: failed === 0 && results.length === messages.length,
      totalRequested: messages.length,
      totalProcessed: results.length,
      totalSuccessful: results.length - failed,
      totalFailed: failed,
      totalSkipped: messages.length - results.length,
      stoppedEarly: results.length < messages.length,
      results,
    };

    return response.status(batch.success ? 201 : 207).json({
      success: batch.success,
      message: batch.success
        ? "All messages were delivered and recorded successfully."
        : "The message batch completed with one or more failures.",
      batch,
    });
  } catch (error) {
    return next(error);
  }
}

export async function retryScopedDueDeliveries(request, response, next) {
  try {
    const dueBefore = request.body?.dueBefore ? new Date(request.body.dueBefore) : new Date();
    if (Number.isNaN(dueBefore.getTime())) {
      const error = new Error("dueBefore must be a valid date.");
      error.statusCode = 400;
      error.code = "INVALID_DUE_DATE";
      throw error;
    }

    const limit = integer(request.body?.limit, 100, 1000);
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const records = await MessageDelivery.find(
      combineScope(scope, {
        status: { $in: ["failed", "undelivered"] },
        "retry.retryable": true,
        "retry.nextRetryAt": { $ne: null, $lte: dueBefore },
        $expr: { $lt: ["$attemptCount", "$maximumAttempts"] },
      })
    )
      .sort({ "retry.nextRetryAt": 1 })
      .limit(limit)
      .select("_id")
      .lean();

    const results = [];
    for (const record of records) {
      try {
        const result = await retryDeliveryRecord(record._id, {
          updatedBy: userId(request),
          retryDelayMs: request.body?.retryDelayMs,
          deferRetries: true,
        });
        results.push({ success: true, deliveryId: String(record._id), result });
      } catch (error) {
        results.push({
          success: false,
          deliveryId: String(record._id),
          error: { message: error.message, code: error.code || "DELIVERY_RETRY_FAILED" },
        });
      }
    }

    const failed = results.filter((item) => !item.success).length;
    const retryBatch = {
      success: failed === 0,
      totalProcessed: results.length,
      totalSuccessful: results.length - failed,
      totalFailed: failed,
      results,
    };

    return response.status(200).json({
      success: retryBatch.success,
      message: retryBatch.success
        ? "Due message-delivery retries processed successfully."
        : "Due message-delivery retries completed with failures.",
      retryBatch,
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  createScopedCampaign,
  createScopedTemplate,
  getScopedCampaignDeliverySummary,
  getScopedCampaignSummary,
  getScopedTemplateSummary,
  listScopedCampaigns,
  listScopedDeliveries,
  listScopedTemplates,
  retryScopedDueDeliveries,
  sendScopedMessage,
  sendScopedMessageBatch,
};
