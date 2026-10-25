import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Customer from "../../../models/customer.js";
import CampaignExecution from "../../campaigns/CampaignExecution.js";
import RetentionJourney from "./RetentionJourney.js";
import RetentionJourneyEnrollment from "./RetentionJourneyEnrollment.js";
import { buildCustomer360 } from "./stage7CrmService.js";
import { requireRetentionBusinessId } from "./stage7RetentionService.js";

function journeyError(message, statusCode = 400, code = "STAGE7_JOURNEY_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function stableKey(parts) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "").trim()).join(":"))
    .digest("hex");
}

async function validateOwnedJourney(journeyId, businessId) {
  if (!mongoose.isValidObjectId(journeyId)) {
    throw journeyError("Retention journey id is invalid.", 400, "RETENTION_JOURNEY_ID_INVALID");
  }

  const journey = await RetentionJourney.findOne({
    _id: journeyId,
    business: businessId,
  }).lean();

  if (!journey) {
    throw journeyError(
      "Retention journey was not found in the active business.",
      404,
      "RETENTION_JOURNEY_NOT_FOUND"
    );
  }

  return journey;
}

async function validateOwnedCustomer(customerId, businessId) {
  if (!mongoose.isValidObjectId(customerId)) {
    throw journeyError("Customer id is invalid.", 400, "CRM_CUSTOMER_ID_INVALID");
  }

  const customer = await Customer.findOne({
    _id: customerId,
    business: businessId,
    status: { $ne: "deleted" },
  })
    .select("_id")
    .lean();

  if (!customer) {
    throw journeyError(
      "Customer was not found in the active business.",
      404,
      "CRM_CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
}

export async function createJourneyEnrollment(
  payload = {},
  { tenantContext = {}, actorId = null } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const journey = await validateOwnedJourney(payload.journeyId, businessId);
  await validateOwnedCustomer(payload.customerId, businessId);

  const trigger = String(payload.trigger || journey.trigger || "").trim().toLowerCase();
  if (!trigger || trigger !== journey.trigger) {
    throw journeyError(
      "Enrollment trigger must match the retention journey trigger.",
      409,
      "RETENTION_TRIGGER_MISMATCH"
    );
  }

  const triggerReference = String(payload.triggerReference || "").trim().slice(0, 500);
  const idempotencyKey = String(payload.idempotencyKey || "").trim() || stableKey([
    businessId,
    journey._id,
    payload.customerId,
    trigger,
    triggerReference || "no-reference",
  ]);

  const customer360 = await buildCustomer360(payload.customerId, {
    tenantContext,
  });

  const stepEvidence = (journey.steps || []).map((step) => ({
    stepOrder: step.order,
    channel: step.channel,
    status: "pending",
    reason: "execution_not_authorised",
    occurredAt: null,
    providerReference: "",
  }));

  const document = {
    business: businessId,
    journey: journey._id,
    customer: payload.customerId,
    trigger,
    triggerReference,
    idempotencyKey,
    status: "pending",
    outcome: "none",
    lifecycleStateAtEnrollment: customer360.lifecycle.state,
    segmentsAtEnrollment: customer360.segments,
    campaign: payload.campaignId || customer360.attribution.latestTouch?.campaign || null,
    executionAuthorised: false,
    stepEvidence,
    createdBy: actorId,
    updatedBy: actorId,
  };

  try {
    return await RetentionJourneyEnrollment.create(document);
  } catch (error) {
    if (error?.code === 11000) {
      return RetentionJourneyEnrollment.findOne({
        business: businessId,
        idempotencyKey,
      });
    }
    throw error;
  }
}

export async function listJourneyEnrollments(
  { tenantContext = {}, customerId = null, journeyId = null, status = null, limit = 100 } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const filter = { business: businessId };

  if (customerId) filter.customer = customerId;
  if (journeyId) filter.journey = journeyId;
  if (status) filter.status = String(status).trim().toLowerCase();

  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  return RetentionJourneyEnrollment.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .lean();
}

export async function recordJourneyOutcome(
  enrollmentId,
  payload = {},
  { tenantContext = {}, actorId = null } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  if (!mongoose.isValidObjectId(enrollmentId)) {
    throw journeyError("Journey enrollment id is invalid.", 400, "RETENTION_ENROLLMENT_ID_INVALID");
  }

  const enrollment = await RetentionJourneyEnrollment.findOne({
    _id: enrollmentId,
    business: businessId,
  });

  if (!enrollment) {
    throw journeyError(
      "Journey enrollment was not found in the active business.",
      404,
      "RETENTION_ENROLLMENT_NOT_FOUND"
    );
  }

  const outcome = String(payload.outcome || "").trim().toLowerCase();
  const allowed = new Set([
    "appointment_booked",
    "purchase_completed",
    "customer_opted_out",
    "membership_payment_recovered",
    "expired",
    "manual_stop",
  ]);

  if (!allowed.has(outcome)) {
    throw journeyError("Unsupported journey outcome.", 400, "RETENTION_OUTCOME_INVALID");
  }

  enrollment.outcome = outcome;
  enrollment.status = ["appointment_booked", "purchase_completed", "membership_payment_recovered"].includes(outcome)
    ? "completed"
    : "stopped";
  enrollment.completedAt = enrollment.status === "completed" ? new Date() : null;
  enrollment.stoppedAt = enrollment.status === "stopped" ? new Date() : null;
  enrollment.updatedBy = actorId || enrollment.updatedBy;
  await enrollment.save();
  return enrollment;
}

export async function campaignJourneyRevenueSummary(
  { tenantContext = {}, campaignId = null } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const campaignFilter = { business: businessId };
  const enrollmentFilter = { business: businessId };

  if (campaignId) {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw journeyError("Campaign id is invalid.", 400, "CAMPAIGN_ID_INVALID");
    }
    campaignFilter.campaign = campaignId;
    enrollmentFilter.campaign = campaignId;
  }

  const [executionRows, enrollmentRows] = await Promise.all([
    CampaignExecution.aggregate([
      { $match: campaignFilter },
      {
        $group: {
          _id: "$campaign",
          revenue: { $sum: "$metrics.revenue" },
          spend: { $sum: "$metrics.spend" },
          conversions: { $sum: "$metrics.conversions" },
          attempted: { $sum: "$metrics.attempted" },
          delivered: { $sum: "$metrics.delivered" },
          executions: { $sum: 1 },
        },
      },
    ]),
    RetentionJourneyEnrollment.aggregate([
      { $match: enrollmentFilter },
      {
        $group: {
          _id: "$campaign",
          enrollments: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          stopped: {
            $sum: { $cond: [{ $eq: ["$status", "stopped"] }, 1, 0] },
          },
          recoveredMemberships: {
            $sum: {
              $cond: [{ $eq: ["$outcome", "membership_payment_recovered"] }, 1, 0],
            },
          },
          rebookings: {
            $sum: {
              $cond: [{ $eq: ["$outcome", "appointment_booked"] }, 1, 0],
            },
          },
          purchases: {
            $sum: {
              $cond: [{ $eq: ["$outcome", "purchase_completed"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const executionByCampaign = new Map(executionRows.map((row) => [String(row._id || "unattributed"), row]));
  const enrollmentByCampaign = new Map(enrollmentRows.map((row) => [String(row._id || "unattributed"), row]));
  const keys = new Set([...executionByCampaign.keys(), ...enrollmentByCampaign.keys()]);

  return Array.from(keys).map((key) => {
    const execution = executionByCampaign.get(key) || {};
    const retention = enrollmentByCampaign.get(key) || {};
    return {
      campaignId: key === "unattributed" ? null : key,
      revenue: Number(execution.revenue || 0),
      spend: Number(execution.spend || 0),
      conversions: Number(execution.conversions || 0),
      executions: Number(execution.executions || 0),
      attempted: Number(execution.attempted || 0),
      delivered: Number(execution.delivered || 0),
      retentionEnrollments: Number(retention.enrollments || 0),
      retentionCompleted: Number(retention.completed || 0),
      retentionStopped: Number(retention.stopped || 0),
      rebookings: Number(retention.rebookings || 0),
      purchases: Number(retention.purchases || 0),
      recoveredMemberships: Number(retention.recoveredMemberships || 0),
    };
  });
}
