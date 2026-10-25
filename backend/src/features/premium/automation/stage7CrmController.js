import {
  buildCustomer360,
  listCrmSegments,
} from "./stage7CrmService.js";
import {
  campaignJourneyRevenueSummary,
  createJourneyEnrollment,
  listJourneyEnrollments,
  recordJourneyOutcome,
} from "./stage7JourneyService.js";
import {
  reconcileStage7MembershipRecoveryJourneys,
} from "./stage7MembershipRecoveryBridge.js";

export async function getCustomer360(req, res) {
  const projection = await buildCustomer360(req.params.customerId, {
    tenantContext: req.tenantContext || {},
  });

  return res.json({ success: true, projection });
}

export async function getCrmSegments(req, res) {
  const customers = await listCrmSegments({
    tenantContext: req.tenantContext || {},
    limit: req.query.limit,
  });

  return res.json({
    success: true,
    count: customers.length,
    customers,
  });
}

export async function createEnrollment(req, res) {
  const enrollment = await createJourneyEnrollment(req.body, {
    tenantContext: req.tenantContext || {},
    actorId: req.user?._id || null,
  });

  return res.status(201).json({
    success: true,
    message: "Customer enrolled with execution disabled until separately authorised.",
    enrollment,
  });
}

export async function getEnrollments(req, res) {
  const enrollments = await listJourneyEnrollments({
    tenantContext: req.tenantContext || {},
    customerId: req.query.customerId || null,
    journeyId: req.query.journeyId || null,
    status: req.query.status || null,
    limit: req.query.limit,
  });

  return res.json({
    success: true,
    count: enrollments.length,
    enrollments,
  });
}

export async function updateEnrollmentOutcome(req, res) {
  const enrollment = await recordJourneyOutcome(
    req.params.enrollmentId,
    req.body,
    {
      tenantContext: req.tenantContext || {},
      actorId: req.user?._id || null,
    }
  );

  return res.json({
    success: true,
    enrollment,
  });
}

export async function reconcileMembershipRecoveryJourneys(req, res) {
  const rawResult = await reconcileStage7MembershipRecoveryJourneys({
    tenantContext: req.tenantContext || {},
    actorId: req.user?._id || null,
    limit: req.body?.limit ?? req.query?.limit,
  });
  const result = {
    ...rawResult,
    processed: Number(rawResult.casesReviewed || 0),
    enrolled:
      Number(rawResult.failedEnrollments || 0) +
      Number(rawResult.recoveryEnrollments || 0),
    recovered: Number(rawResult.recoveredExistingEnrollments || 0),
  };

  return res.json({
    success: true,
    message: "Membership recovery cases reconciled into retention journey evidence. No payment state was changed and no communication was sent.",
    result,
  });
}

export async function getCampaignJourneyRevenue(req, res) {
  const rows = await campaignJourneyRevenueSummary({
    tenantContext: req.tenantContext || {},
    campaignId: req.query.campaignId || null,
  });

  return res.json({
    success: true,
    rows,
  });
}
