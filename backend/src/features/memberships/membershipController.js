import {
  createMembershipContract,
  createMembershipPlan,
  freezeMembershipContract,
  getMembershipContract,
  listMembershipContracts,
  listMembershipPlans,
  resumeMembershipContract,
  updateMembershipContract,
  updateMembershipPlan,
} from "./membershipService.js";
import {
  issueMembershipBenefits,
  membershipBenefitBalances,
  redeemMembershipBenefit,
} from "./membershipBenefitService.js";
import {
  recordMembershipCollectionAndRefreshBenefits,
} from "./membershipCollectionOrchestrator.js";
import {
  projectStoredValueSettlement,
} from "../finance/settlementService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;

  if (!value) {
    throw createServiceError(
      "A trusted active business is required for membership operations.",
      400
    );
  }
  return value;
}

function actor(request) {
  return String(
    request.user?._id ||
    request.user?.id ||
    request.user?.email ||
    "system"
  );
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function plans(request, response) {
  response.json({
    items: await listMembershipPlans(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function createPlan(request, response) {
  response.status(201).json(
    await createMembershipPlan(body(request), {
      businessId: businessId(request),
    })
  );
}

export async function updatePlan(request, response) {
  response.json(
    await updateMembershipPlan(request.params.planId, body(request), {
      businessId: businessId(request),
    })
  );
}

export async function contracts(request, response) {
  response.json({
    items: await listMembershipContracts(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function contract(request, response) {
  response.json(
    await getMembershipContract(request.params.id, {
      businessId: businessId(request),
    })
  );
}

export async function createContract(request, response) {
  response.status(201).json(
    await createMembershipContract(body(request), {
      businessId: businessId(request),
    })
  );
}

export async function updateContract(request, response) {
  response.json(
    await updateMembershipContract(request.params.id, body(request), {
      businessId: businessId(request),
    })
  );
}

export async function freezeContract(request, response) {
  response.json(
    await freezeMembershipContract(request.params.id, body(request), {
      businessId: businessId(request),
    })
  );
}

export async function resumeContract(request, response) {
  response.json(
    await resumeMembershipContract(request.params.id, {
      businessId: businessId(request),
    })
  );
}

export async function collectContract(request, response) {
  const result = await recordMembershipCollectionAndRefreshBenefits(
    request.params.id,
    body(request),
    {
      businessId: businessId(request),
      actor: actor(request),
    }
  );

  response
    .status(result.benefitRefresh?.status === "pending" ? 202 : 201)
    .json(result);
}

export async function benefitBalances(request, response) {
  response.json({
    items: await membershipBenefitBalances(request.params.id, {
      businessId: businessId(request),
    }),
  });
}

export async function issueBenefits(request, response) {
  response.status(201).json({
    items: await issueMembershipBenefits(request.params.id, body(request), {
      businessId: businessId(request),
      actor: actor(request),
    }),
  });
}

export async function redeemBenefit(request, response) {
  const activeBusinessId = businessId(request);
  const redemption = await redeemMembershipBenefit(
    request.params.id,
    request.params.benefitKey,
    body(request),
    {
      businessId: activeBusinessId,
      actor: actor(request),
    }
  );

  /*
   * Stored-value ledger evidence remains the source of truth. Re-project on
   * idempotent retries as well as first writes so a transient projection
   * failure can heal without posting a second redemption. The projector is
   * reconciliation-only and cannot initiate money movement.
   */
  const settlement =
    redemption.unit === "money" && redemption.entry?._id
      ? await projectStoredValueSettlement(redemption.entry._id, {
          businessId: activeBusinessId,
        })
      : {
          projected: false,
          reason: "non-money-unit",
        };

  response.status(201).json({
    ...redemption,
    settlement,
    paymentExecutionAllowed: false,
  });
}

export default {
  benefitBalances,
  collectContract,
  contract,
  contracts,
  createContract,
  createPlan,
  freezeContract,
  issueBenefits,
  plans,
  redeemBenefit,
  resumeContract,
  updateContract,
  updatePlan,
};
