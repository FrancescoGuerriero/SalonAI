import CollectionAttempt from "../../models/CollectionAttempt.js";
import {
  getMembershipContract,
  recordMembershipCollection,
} from "./membershipService.js";
import {
  refreshMembershipBenefitsForCycle,
} from "./membershipBenefitService.js";

function text(value) {
  return String(value ?? "").trim();
}

async function existingAttempt(businessId, idempotencyKey) {
  if (!idempotencyKey) return null;
  return CollectionAttempt.findOne({
    business: businessId,
    idempotencyKey,
  }).lean();
}

async function refreshAfterSuccessfulCollection(
  contractId,
  attempt,
  {
    businessId,
    actor = "system",
  } = {}
) {
  if (!attempt || attempt.status !== "succeeded") {
    return {
      status: "not_required",
      items: [],
    };
  }

  try {
    const items = await refreshMembershipBenefitsForCycle(
      contractId,
      {
        cycleKey: new Date(attempt.dueAt).toISOString(),
        occurredAt: attempt.attemptedAt || new Date(),
        idempotencyPrefix: `membership:${contractId}:collection:${attempt.idempotencyKey}`,
      },
      {
        businessId,
        actor,
      }
    );

    return {
      status: "applied",
      items,
    };
  } catch (error) {
    return {
      status: "pending",
      items: [],
      code: error.code || "MEMBERSHIP_BENEFIT_REFRESH_FAILED",
      message: error.message,
    };
  }
}

export async function recordMembershipCollectionAndRefreshBenefits(
  contractId,
  payload = {},
  {
    businessId,
    actor = "system",
  } = {}
) {
  const key = text(payload.idempotencyKey);
  const priorAttempt = await existingAttempt(businessId, key);

  if (priorAttempt) {
    const contract = await getMembershipContract(contractId, { businessId });
    const benefitRefresh = await refreshAfterSuccessfulCollection(
      contractId,
      priorAttempt,
      { businessId, actor }
    );

    return {
      contract,
      collectionAttempt: priorAttempt,
      idempotentReplay: true,
      benefitRefresh,
    };
  }

  const result = await recordMembershipCollection(
    contractId,
    payload,
    { businessId }
  );

  const benefitRefresh = await refreshAfterSuccessfulCollection(
    contractId,
    result.collectionAttempt,
    { businessId, actor }
  );

  return {
    ...result,
    idempotentReplay: false,
    benefitRefresh,
  };
}

export default {
  recordMembershipCollectionAndRefreshBenefits,
};
