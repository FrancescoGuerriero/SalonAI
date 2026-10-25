import mongoose from "mongoose";

import RetentionJourney from "./RetentionJourney.js";
import {
  normaliseRetentionJourneyPayload,
  previewRetentionJourney as previewLegacyRetentionJourney,
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
  { tenantContext = {}, limit } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  await ownedJourney(journeyId, businessId);

  const preview = await previewLegacyRetentionJourney(journeyId, { limit });

  return {
    ...preview,
    businessId,
    executionAuthorised: false,
  };
}
