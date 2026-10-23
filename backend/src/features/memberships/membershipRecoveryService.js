import MembershipRecoveryCase from "./MembershipRecoveryCase.js";

function id(value) {
  return value?._id || value?.id || value || null;
}

export async function reconcileMembershipRecovery(
  contract,
  collectionAttempt,
  {
    businessId,
  } = {}
) {
  if (!contract || !collectionAttempt) {
    return {
      status: "not_required",
      recoveryCase: null,
    };
  }

  const business = id(businessId || contract.business || collectionAttempt.business);
  const membershipContract = id(contract._id || contract.id || collectionAttempt.membershipContract);
  const customer = id(contract.customer);
  const attemptId = id(collectionAttempt._id || collectionAttempt.id);

  if (!business || !membershipContract || !customer || !attemptId) {
    return {
      status: "not_required",
      recoveryCase: null,
    };
  }

  if (collectionAttempt.status === "failed") {
    const recoveryCase = await MembershipRecoveryCase.findOneAndUpdate(
      {
        collectionAttempt: attemptId,
      },
      {
        $setOnInsert: {
          business,
          membershipContract,
          customer,
          collectionAttempt: attemptId,
          status: "open",
          failureCode: String(collectionAttempt.failureCode || "").trim(),
          provider: String(collectionAttempt.provider || "").trim().toLowerCase(),
          providerReference: String(collectionAttempt.providerReference || "").trim(),
          failedAt: collectionAttempt.attemptedAt || new Date(),
          nextActionAt: collectionAttempt.nextRetryAt || new Date(),
          metadata: {
            attemptNumber: Number(collectionAttempt.attemptNumber || 1),
            amount: Number(collectionAttempt.amount || 0),
            currency: String(collectionAttempt.currency || "GBP").toUpperCase(),
          },
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return {
      status: "open",
      recoveryCase,
    };
  }

  if (collectionAttempt.status === "succeeded") {
    const now = new Date();
    const result = await MembershipRecoveryCase.updateMany(
      {
        business,
        membershipContract,
        status: { $in: ["open", "escalated"] },
      },
      {
        $set: {
          status: "recovered",
          recoveredAt: now,
          nextActionAt: null,
          resolvedByCollectionAttempt: attemptId,
        },
      }
    );

    return {
      status: result.modifiedCount > 0 ? "recovered" : "not_required",
      recoveredCount: Number(result.modifiedCount || 0),
      recoveryCase: null,
    };
  }

  return {
    status: "not_required",
    recoveryCase: null,
  };
}

export async function listMembershipRecoveryCases(
  query = {},
  {
    businessId,
  } = {}
) {
  const match = {
    business: businessId,
  };

  if (query.status) {
    match.status = String(query.status).trim().toLowerCase();
  }

  if (query.membershipContract) {
    match.membershipContract = query.membershipContract;
  }

  return MembershipRecoveryCase.find(match)
    .populate("customer", "firstName lastName preferredName")
    .populate("membershipContract", "status collectionStatus nextCollectionAt")
    .sort({ nextActionAt: 1, failedAt: 1, _id: 1 })
    .lean();
}

export default {
  listMembershipRecoveryCases,
  reconcileMembershipRecovery,
};
