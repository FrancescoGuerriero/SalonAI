import { createServiceError } from "../../shared/serviceError.js";

/**
 * Fail closed after an incomplete ingestion. This is an operator review gate,
 * NOT automatic rollback or reconstruction of the last provider page.
 * Caller must already hold the unique import lease and trusted tenant scope.
 */
export async function assertSellerRecoveryReviewed({
  runModel, businessId, connection, kind, recoveryAcknowledged = false,
} = {}) {
  if (!runModel || !businessId || !connection?._id ||
      !["listings", "orders"].includes(kind)) {
    throw createServiceError("Seller recovery scope is not available.", 403, {
      code: "SELLER_RECOVERY_SCOPE_REQUIRED",
    });
  }
  const latest = await runModel.findOne({
    business: businessId, connection: connection._id,
    provider: connection.provider, kind,
  }).select("state failureClass stagedCount")
    .sort({ startedAt: -1, _id: -1 }).lean();

  const state = latest?.state || null;
  const requiresReview = Boolean(state && state !== "completed");
  if (requiresReview && recoveryAcknowledged !== true) {
    throw createServiceError(
      "Previous seller import is incomplete. Review import status and explicitly acknowledge a new attempt.",
      409, { code: "SELLER_RECOVERY_REVIEW_REQUIRED" }
    );
  }
  return Object.freeze({
    recoveryReviewRequired: requiresReview,
    recoveryAcknowledged: requiresReview && recoveryAcknowledged === true,
    previousState: state,
    previousFailureClass: state === "failed" ? latest.failureClass || "unknown" : null,
    previousStagedCount: latest?.stagedCount ?? null,
    rollbackPerformed: false, canonicalRecordsWritten: 0,
  });
}
