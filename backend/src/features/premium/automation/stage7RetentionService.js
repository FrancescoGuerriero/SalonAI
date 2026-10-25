import mongoose from "mongoose";

import ConsentRecord from "../../../models/ConsentRecord.js";
import Customer from "../../../models/customer.js";
import RetentionJourney from "./RetentionJourney.js";
import {
  buildInactiveRetentionPreviewPipeline,
  evaluateRetentionContactReadiness,
  normaliseRetentionJourneyPayload,
} from "./retentionAutomationService.js";

function serviceError(message, statusCode = 400, code = "RETENTION_STAGE7_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function requireRetentionBusinessId(tenantContext = {}) {
  const businessId = String(tenantContext.businessId || "").trim();
  if (!businessId || !mongoose.isValidObjectId(businessId)) {
    throw serviceError(
      "A trusted business context is required for retention automation.",
      403,
      "RETENTION_BUSINESS_CONTEXT_REQUIRED"
    );
  }
  return businessId;
}

async function ownedJourney(journeyId, businessId) {
  if (!mongoose.isValidObjectId(journeyId)) {
    throw serviceError("Retention journey id is invalid.", 400, "RETENTION_JOURNEY_ID_INVALID");
  }

  const journey = await RetentionJourney.findOne({
    _id: journeyId,
    business: businessId,
  });

  if (!journey) {
    throw serviceError(
      "Retention journey was not found in the active business.",
      404,
      "RETENTION_JOURNEY_NOT_FOUND"
    );
  }

  return journey;
}

function evidenceKey(customerId, purpose) {
  return `${String(customerId || "")}:${purpose}`;
}

async function loadStage7ConsentEvidence(items = []) {
  const accountIds = Array.from(
    new Set(items.map((item) => item?.userAccount).filter(Boolean).map(String))
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (!accountIds.length) return new Map();

  const records = await ConsentRecord.aggregate([
    {
      $match: {
        customer: { $in: accountIds },
        purpose: { $in: ["whatsapp_marketing", "push_marketing"] },
      },
    },
    { $sort: { recordedAt: -1, createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: { customer: "$customer", purpose: "$purpose" },
        granted: { $first: "$granted" },
        recordedAt: { $first: "$recordedAt" },
      },
    },
  ]);

  return new Map(
    records.map((record) => [
      evidenceKey(record?._id?.customer, record?._id?.purpose),
      {
        granted: record?.granted === true,
        recordedAt: record?.recordedAt || null,
      },
    ])
  );
}

export async function listStage7RetentionJourneys(tenantContext = {}) {
  const businessId = requireRetentionBusinessId(tenantContext);
  return RetentionJourney.find({ business: businessId })
    .sort({ enabled: -1, updatedAt: -1, createdAt: -1 })
    .lean();
}

export async function createStage7RetentionJourney(
  payload,
  { tenantContext = {}, actorId = null } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const normalised = normaliseRetentionJourneyPayload(payload);

  return RetentionJourney.create({
    ...normalised,
    business: businessId,
    enabled: false,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

export async function updateStage7RetentionJourney(
  journeyId,
  payload,
  { tenantContext = {}, actorId = null } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const journey = await ownedJourney(journeyId, businessId);
  const normalised = normaliseRetentionJourneyPayload(payload, { partial: true });

  for (const [key, value] of Object.entries(normalised)) {
    journey[key] = value;
  }

  journey.updatedBy = actorId || journey.updatedBy;
  await journey.save();
  return journey;
}

export async function previewStage7RetentionJourney(
  journeyId,
  { tenantContext = {}, limit = 50 } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const journey = await ownedJourney(journeyId, businessId);
  const requiredChannels = Array.from(
    new Set((journey.steps || []).map((step) => step.channel).filter(Boolean))
  );
  const previewedAt = new Date();
  const baseResult = {
    dryRun: true,
    communicationQueued: false,
    executionAuthorised: false,
    businessId,
    previewedAt,
    journey: {
      _id: journey._id,
      name: journey.name,
      trigger: journey.trigger,
      enabled: journey.enabled === true,
    },
    requiredChannels,
  };

  if (journey.trigger !== "customer_inactive") {
    return {
      ...baseResult,
      supported: false,
      candidateCount: 0,
      returnedCount: 0,
      truncated: false,
      items: [],
      message:
        "Audience preview is currently implemented only for customer-inactive journeys. No communication was queued.",
    };
  }

  const built = buildInactiveRetentionPreviewPipeline({
    conditions: journey.conditions,
    now: previewedAt,
    limit,
  });

  built.pipeline[0].$match.business = new mongoose.Types.ObjectId(businessId);

  const [result] = await Customer.aggregate(built.pipeline);
  const rawItems = Array.isArray(result?.items) ? result.items : [];
  const consentEvidence = await loadStage7ConsentEvidence(rawItems);

  const items = rawItems.map((item) => {
    const readiness = evaluateRetentionContactReadiness(item, {
      requiredChannels,
      consentEvidence,
    });
    const {
      userAccount: _userAccount,
      communicationPreferences: _communicationPreferences,
      marketing: _marketing,
      ...publicItem
    } = item;
    return { ...publicItem, readiness };
  });

  const candidateCount = Number(result?.summary?.[0]?.count) || 0;

  return {
    ...baseResult,
    supported: true,
    conditions: built.conditions,
    cutoff: built.cutoff,
    candidateCount,
    returnedCount: items.length,
    truncated: candidateCount > items.length,
    fullyContactReadyCount: items.filter((item) => item.readiness?.fullyReady === true).length,
    items,
  };
}
