import MembershipRecoveryCase from "../../memberships/MembershipRecoveryCase.js";
import RetentionJourney from "./RetentionJourney.js";
import RetentionJourneyEnrollment from "./RetentionJourneyEnrollment.js";
import { createJourneyEnrollment } from "./stage7JourneyService.js";
import { requireRetentionBusinessId } from "./stage7RetentionService.js";

function recoveryReference(recoveryCaseId) {
  return `membership-recovery:${String(recoveryCaseId)}`;
}

export async function reconcileStage7MembershipRecoveryJourneys(
  { tenantContext = {}, actorId = null, limit = 100 } = {}
) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));

  const [cases, failedJourneys, recoveredJourneys] = await Promise.all([
    MembershipRecoveryCase.find({
      business: businessId,
      status: { $in: ["open", "escalated", "recovered"] },
    })
      .sort({ updatedAt: 1, _id: 1 })
      .limit(safeLimit)
      .select("_id customer status recoveredAt resolvedByCollectionAttempt updatedAt")
      .lean(),
    RetentionJourney.find({
      business: businessId,
      enabled: true,
      trigger: "membership_payment_failed",
    })
      .select("_id trigger")
      .lean(),
    RetentionJourney.find({
      business: businessId,
      enabled: true,
      trigger: "membership_payment_recovered",
    })
      .select("_id trigger")
      .lean(),
  ]);

  let failedEnrollments = 0;
  let recoveryEnrollments = 0;
  let recoveredExistingEnrollments = 0;

  for (const recoveryCase of cases) {
    const triggerReference = recoveryReference(recoveryCase._id);

    if (["open", "escalated"].includes(recoveryCase.status)) {
      for (const journey of failedJourneys) {
        await createJourneyEnrollment(
          {
            journeyId: journey._id,
            customerId: recoveryCase.customer,
            trigger: "membership_payment_failed",
            triggerReference,
          },
          { tenantContext, actorId }
        );
        failedEnrollments += 1;
      }
      continue;
    }

    if (recoveryCase.status === "recovered") {
      const now = recoveryCase.recoveredAt || recoveryCase.updatedAt || new Date();
      const result = await RetentionJourneyEnrollment.updateMany(
        {
          business: businessId,
          customer: recoveryCase.customer,
          trigger: "membership_payment_failed",
          triggerReference,
          status: { $in: ["pending", "active", "paused"] },
        },
        {
          $set: {
            status: "completed",
            outcome: "membership_payment_recovered",
            completedAt: now,
            updatedBy: actorId,
          },
        }
      );
      recoveredExistingEnrollments += Number(result.modifiedCount || 0);

      for (const journey of recoveredJourneys) {
        await createJourneyEnrollment(
          {
            journeyId: journey._id,
            customerId: recoveryCase.customer,
            trigger: "membership_payment_recovered",
            triggerReference,
          },
          { tenantContext, actorId }
        );
        recoveryEnrollments += 1;
      }
    }
  }

  return {
    businessId,
    casesReviewed: cases.length,
    enabledFailureJourneys: failedJourneys.length,
    enabledRecoveryJourneys: recoveredJourneys.length,
    failedEnrollments,
    recoveryEnrollments,
    recoveredExistingEnrollments,
    executionAuthorised: false,
    financialStateMutated: false,
  };
}

export default {
  reconcileStage7MembershipRecoveryJourneys,
};
