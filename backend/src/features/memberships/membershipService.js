import mongoose from "mongoose";

import CollectionAttempt from "../../models/CollectionAttempt.js";
import Customer from "../../models/customer.js";
import MembershipContract from "../../models/MembershipContract.js";
import MembershipPlan from "../../models/MembershipPlan.js";
import {
  planMembershipCollectionRetry,
} from "../../platform/memberships/membershipContract.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const ACTIVE_PLAN_STATUSES = ["draft", "active", "retired"];
const CONTRACT_STATUSES = [
  "trial",
  "active",
  "frozen",
  "past_due",
  "cancelled",
  "expired",
];

function text(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      `${field} must be a valid identifier.`,
      400,
      { field }
    );
  }
  return value;
}

function money(value, field, { required = true } = {}) {
  if ((value === undefined || value === null || value === "") && !required) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw createServiceError(
      `${field} must be a non-negative number.`,
      400,
      { field }
    );
  }
  return number;
}

function integer(value, field, fallback = undefined) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw createServiceError(
      `${field} must be a positive integer.`,
      400,
      { field }
    );
  }
  return number;
}

function date(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw createServiceError(
      `${field} must be a valid date.`,
      400,
      { field }
    );
  }
  return result;
}

function status(value, field, allowed, fallback) {
  const normalised = text(value || fallback).toLowerCase().replaceAll("-", "_");
  const mapped = normalised === "paused" ? "frozen" : normalised;
  if (!allowed.includes(mapped)) {
    throw createServiceError(
      `${field} must be one of: ${allowed.join(", ")}.`,
      400,
      { field }
    );
  }
  return mapped;
}

function normaliseBenefits(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((benefit, index) => {
      if (typeof benefit === "string") {
        const key = slug(benefit) || `benefit-${index + 1}`;
        return {
          key,
          allowance: 1,
          unit: "quantity",
          rolloverEnabled: false,
          rolloverLimit: 0,
        };
      }

      if (!benefit || typeof benefit !== "object") {
        return null;
      }

      const key = slug(benefit.key || benefit.name || `benefit-${index + 1}`);
      const allowance = money(
        benefit.allowance ?? 1,
        `benefits[${index}].allowance`
      );
      const unit = text(benefit.unit || "quantity").toLowerCase();

      if (!["money", "quantity", "points"].includes(unit)) {
        throw createServiceError(
          `benefits[${index}].unit is invalid.`,
          400,
          { field: `benefits[${index}].unit` }
        );
      }

      return {
        key,
        allowance,
        unit,
        rolloverEnabled: Boolean(benefit.rolloverEnabled),
        rolloverLimit: money(
          benefit.rolloverLimit ?? 0,
          `benefits[${index}].rolloverLimit`
        ),
      };
    })
    .filter(Boolean);
}

function billingMonths(plan) {
  const count = Number(plan?.billingIntervalCount) || 1;

  switch (plan?.billingFrequency) {
    case "monthly":
      return count;
    case "quarterly":
      return count * 3;
    case "annual":
      return count * 12;
    default:
      return 0;
  }
}

function nextCollectionDate(plan, fromValue) {
  const months = billingMonths(plan);
  if (!months) {
    return null;
  }

  const from = date(fromValue || new Date(), "collectionDate");
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

async function customerForBusiness(customerId, businessId, session = null) {
  objectId(customerId, "customer");
  objectId(businessId, "business");

  let query = Customer.findOne({
    _id: customerId,
    $or: [
      { business: businessId },
      { business: { $exists: false } },
      { business: null },
    ],
  });

  if (session) {
    query = query.session(session);
  }

  return assertFound(
    await query,
    "Customer not found in the active business."
  );
}

async function planById(planId, businessId, session = null) {
  objectId(planId, "plan");

  let query = MembershipPlan.findOne({
    _id: planId,
    business: businessId,
  });

  if (session) {
    query = query.session(session);
  }

  return assertFound(
    await query,
    "Membership plan not found."
  );
}

async function resolvePlan(payload, businessId, session = null) {
  if (payload.plan) {
    return planById(payload.plan, businessId, session);
  }

  const planName = text(payload.planName);
  if (!planName) {
    throw createServiceError(
      "A membership plan or plan name is required.",
      400,
      { field: "plan" }
    );
  }

  const key = slug(payload.planKey || planName);
  let query = MembershipPlan.findOne({
    business: businessId,
    key,
  });

  if (session) {
    query = query.session(session);
  }

  let plan = await query;
  if (plan) {
    return plan;
  }

  const planPayload = {
    business: businessId,
    key,
    name: planName,
    status: "active",
    billingFrequency: text(payload.billingFrequency || "monthly").toLowerCase(),
    billingIntervalCount: integer(
      payload.billingIntervalCount,
      "billingIntervalCount",
      1
    ),
    price: money(payload.price, "price"),
    currency: text(payload.currency || "GBP").toUpperCase(),
    benefits: normaliseBenefits(payload.benefits),
    freezePolicy: payload.freezePolicy || undefined,
    familySharing: payload.familySharing || undefined,
    collectionRetryDays: Array.isArray(payload.collectionRetryDays)
      ? payload.collectionRetryDays
      : undefined,
  };

  if (session) {
    [plan] = await MembershipPlan.create([planPayload], { session });
  } else {
    plan = await MembershipPlan.create(planPayload);
  }

  return plan;
}

function planPatch(payload) {
  const patch = {};

  if (payload.name !== undefined) patch.name = text(payload.name);
  if (payload.status !== undefined) {
    patch.status = status(payload.status, "status", ACTIVE_PLAN_STATUSES, "draft");
  }
  if (payload.billingFrequency !== undefined) {
    const value = text(payload.billingFrequency).toLowerCase();
    if (!["monthly", "quarterly", "annual", "custom"].includes(value)) {
      throw createServiceError("billingFrequency is invalid.", 400, {
        field: "billingFrequency",
      });
    }
    patch.billingFrequency = value;
  }
  if (payload.billingIntervalCount !== undefined) {
    patch.billingIntervalCount = integer(
      payload.billingIntervalCount,
      "billingIntervalCount"
    );
  }
  if (payload.price !== undefined) patch.price = money(payload.price, "price");
  if (payload.currency !== undefined) {
    const currency = text(payload.currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw createServiceError(
        "currency must be a three-letter code.",
        400,
        { field: "currency" }
      );
    }
    patch.currency = currency;
  }
  if (payload.benefits !== undefined) {
    patch.benefits = normaliseBenefits(payload.benefits);
  }
  if (payload.freezePolicy !== undefined) patch.freezePolicy = payload.freezePolicy;
  if (payload.familySharing !== undefined) patch.familySharing = payload.familySharing;
  if (payload.collectionRetryDays !== undefined) {
    patch.collectionRetryDays = payload.collectionRetryDays;
  }
  if (payload.storedValueProgram !== undefined) {
    patch.storedValueProgram = payload.storedValueProgram || null;
  }

  return patch;
}

export async function createMembershipPlan(payload = {}, { businessId } = {}) {
  objectId(businessId, "business");

  const name = text(payload.name || payload.planName);
  const key = slug(payload.key || payload.planKey || name);

  if (!name || !key) {
    throw createServiceError(
      "Membership plan name is required.",
      400,
      { field: "name" }
    );
  }

  return MembershipPlan.create({
    business: businessId,
    key,
    name,
    status: status(payload.status, "status", ACTIVE_PLAN_STATUSES, "draft"),
    billingFrequency: text(payload.billingFrequency || "monthly").toLowerCase(),
    billingIntervalCount: integer(
      payload.billingIntervalCount,
      "billingIntervalCount",
      1
    ),
    price: money(payload.price, "price"),
    currency: text(payload.currency || "GBP").toUpperCase(),
    storedValueProgram: payload.storedValueProgram || null,
    benefits: normaliseBenefits(payload.benefits),
    freezePolicy: payload.freezePolicy || undefined,
    familySharing: payload.familySharing || undefined,
    collectionRetryDays: Array.isArray(payload.collectionRetryDays)
      ? payload.collectionRetryDays
      : undefined,
  });
}

export async function listMembershipPlans(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) {
    match.status = status(query.status, "status", ACTIVE_PLAN_STATUSES, "active");
  }

  return MembershipPlan.find(match)
    .sort({ status: 1, name: 1, _id: 1 })
    .lean();
}

export async function updateMembershipPlan(planId, payload = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const plan = await planById(planId, businessId);
  Object.assign(plan, planPatch(payload));
  await plan.save();
  return plan.toObject();
}

export async function createMembershipContract(payload = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const customer = await customerForBusiness(payload.customer, businessId);
  const plan = await resolvePlan(payload, businessId);
  const startsAt = date(payload.startsAt || new Date(), "startsAt");
  const endsAt = date(payload.endsAt, "endsAt", { optional: true });
  const renewsAt = date(payload.renewsAt, "renewsAt", { optional: true });

  if (endsAt && endsAt <= startsAt) {
    throw createServiceError(
      "Membership contract end must be after its start.",
      400,
      { field: "endsAt" }
    );
  }

  const contract = await MembershipContract.create({
    business: businessId,
    customer: customer._id,
    homeLocation: payload.homeLocation || null,
    plan: plan._id,
    status: status(payload.status, "status", CONTRACT_STATUSES, "active"),
    startsAt,
    renewsAt,
    endsAt,
    familyMemberCustomers: Array.isArray(payload.familyMemberCustomers)
      ? payload.familyMemberCustomers
      : [],
    paymentProvider: text(payload.paymentProvider).toLowerCase(),
    paymentProviderSubscriptionId: text(payload.paymentProviderSubscriptionId),
    collectionStatus: text(payload.collectionStatus || "not_due").toLowerCase(),
    nextCollectionAt:
      date(payload.nextCollectionAt, "nextCollectionAt", { optional: true }) ||
      renewsAt ||
      nextCollectionDate(plan, startsAt),
    metadata: payload.metadata || {},
  });

  return getMembershipContract(contract._id, { businessId });
}

export async function listMembershipContracts(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };

  if (query.customer) match.customer = objectId(query.customer, "customer");
  if (query.status) {
    match.status = status(query.status, "status", CONTRACT_STATUSES, "active");
  }
  if (query.plan) match.plan = objectId(query.plan, "plan");

  return MembershipContract.find(match)
    .populate("customer", "firstName lastName fullName preferredName name email phone")
    .populate(
      "plan",
      "key name status billingFrequency billingIntervalCount price currency benefits freezePolicy familySharing storedValueProgram"
    )
    .sort({ createdAt: -1, _id: -1 })
    .lean();
}

export async function getMembershipContract(contractId, { businessId } = {}) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  return assertFound(
    await MembershipContract.findOne({
      _id: contractId,
      business: businessId,
    })
      .populate("customer", "firstName lastName fullName preferredName name email phone")
      .populate(
        "plan",
        "key name status billingFrequency billingIntervalCount price currency benefits freezePolicy familySharing storedValueProgram collectionRetryDays"
      )
      .lean(),
    "Membership contract not found."
  );
}

export async function updateMembershipContract(
  contractId,
  payload = {},
  { businessId } = {}
) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  const contract = assertFound(
    await MembershipContract.findOne({
      _id: contractId,
      business: businessId,
    }),
    "Membership contract not found."
  );

  if (payload.plan || payload.planName) {
    contract.plan = (await resolvePlan(payload, businessId))._id;
  }
  if (payload.status !== undefined) {
    contract.status = status(
      payload.status,
      "status",
      CONTRACT_STATUSES,
      contract.status
    );
  }

  for (const field of [
    "homeLocation",
    "renewsAt",
    "endsAt",
    "paymentProvider",
    "paymentProviderSubscriptionId",
    "collectionStatus",
    "nextCollectionAt",
    "metadata",
  ]) {
    if (payload[field] === undefined) continue;
    if (["renewsAt", "endsAt", "nextCollectionAt"].includes(field)) {
      contract[field] = date(payload[field], field, { optional: true });
    } else if (field === "paymentProvider") {
      contract[field] = text(payload[field]).toLowerCase();
    } else if (field === "paymentProviderSubscriptionId") {
      contract[field] = text(payload[field]);
    } else {
      contract[field] = payload[field];
    }
  }

  if (payload.familyMemberCustomers !== undefined) {
    contract.familyMemberCustomers = Array.isArray(payload.familyMemberCustomers)
      ? payload.familyMemberCustomers
      : [];
  }

  await contract.save();
  return getMembershipContract(contract._id, { businessId });
}

export async function freezeMembershipContract(contractId, payload = {}, { businessId } = {}) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  const contract = assertFound(
    await MembershipContract.findOne({
      _id: contractId,
      business: businessId,
    }).populate("plan"),
    "Membership contract not found."
  );

  if (!["trial", "active", "past_due"].includes(contract.status)) {
    throw createServiceError(`A ${contract.status} membership cannot be frozen.`, 409);
  }
  if (!contract.plan?.freezePolicy?.allowed) {
    throw createServiceError("This membership plan does not allow freezing.", 409);
  }

  const frozenAt = new Date();
  const resumesAt = date(payload.resumesAt, "resumesAt", { optional: true });
  if (resumesAt && resumesAt <= frozenAt) {
    throw createServiceError(
      "resumesAt must be after the freeze start.",
      400,
      { field: "resumesAt" }
    );
  }

  if (resumesAt) {
    const requestedDays = Math.ceil(
      (resumesAt.getTime() - frozenAt.getTime()) / 86400000
    );
    const remaining = Math.max(
      0,
      Number(contract.plan.freezePolicy.maxDaysPerYear || 0) -
        Number(contract.freezeDaysUsed || 0)
    );
    if (requestedDays > remaining) {
      throw createServiceError(
        "The requested freeze exceeds the remaining annual freeze allowance.",
        409,
        { field: "resumesAt" }
      );
    }
  }

  contract.status = "frozen";
  contract.frozenAt = frozenAt;
  contract.resumesAt = resumesAt;
  await contract.save();
  return getMembershipContract(contract._id, { businessId });
}

export async function resumeMembershipContract(contractId, { businessId } = {}) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  const contract = assertFound(
    await MembershipContract.findOne({
      _id: contractId,
      business: businessId,
    }),
    "Membership contract not found."
  );

  if (contract.status !== "frozen") {
    throw createServiceError("Only a frozen membership can be resumed.", 409);
  }

  const now = new Date();
  const frozenAt = contract.frozenAt || now;
  contract.freezeDaysUsed =
    Number(contract.freezeDaysUsed || 0) +
    Math.max(0, Math.ceil((now.getTime() - frozenAt.getTime()) / 86400000));
  contract.status = "active";
  contract.frozenAt = null;
  contract.resumesAt = null;
  await contract.save();
  return getMembershipContract(contract._id, { businessId });
}

export async function recordMembershipCollection(
  contractId,
  payload = {},
  { businessId } = {}
) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  const databaseSession = await mongoose.startSession();
  let attemptId = null;

  try {
    await databaseSession.withTransaction(async () => {
      const contract = assertFound(
        await MembershipContract.findOne({
          _id: contractId,
          business: businessId,
        })
          .populate("plan")
          .session(databaseSession),
        "Membership contract not found."
      );

      if (["cancelled", "expired"].includes(contract.status)) {
        throw createServiceError(
          `A ${contract.status} membership cannot be collected.`,
          409
        );
      }

      const result = text(payload.status || payload.result).toLowerCase();
      if (!["succeeded", "failed"].includes(result)) {
        throw createServiceError(
          "Collection status must be succeeded or failed.",
          400,
          { field: "status" }
        );
      }

      const dueAt = date(
        payload.dueAt || contract.nextCollectionAt || new Date(),
        "dueAt"
      );
      const attemptedAt = date(payload.attemptedAt || new Date(), "attemptedAt");
      const attemptNumber =
        (await CollectionAttempt.countDocuments({
          business: businessId,
          membershipContract: contract._id,
          dueAt,
        }).session(databaseSession)) + 1;

      const amount = money(payload.amount ?? contract.plan?.price ?? 0, "amount");
      const idempotencyKey =
        text(payload.idempotencyKey) ||
        `membership:${contract._id}:${dueAt.toISOString()}:${attemptNumber}`;
      const retry =
        result === "failed"
          ? planMembershipCollectionRetry({
              attemptNumber,
              failedAt: attemptedAt,
              retryDays: contract.plan?.collectionRetryDays || [1, 3, 7],
            })
          : null;

      let attempt;
      [attempt] = await CollectionAttempt.create(
        [
          {
            business: businessId,
            membershipContract: contract._id,
            dueAt,
            attemptedAt,
            amount,
            currency: contract.plan?.currency || "GBP",
            attemptNumber,
            status: result,
            provider: text(payload.provider || contract.paymentProvider).toLowerCase(),
            providerReference: text(payload.providerReference),
            failureCode: result === "failed" ? text(payload.failureCode) : "",
            nextRetryAt:
              retry?.retry && retry.nextRetryAt
                ? new Date(retry.nextRetryAt)
                : null,
            idempotencyKey,
          },
        ],
        { session: databaseSession }
      );
      attemptId = attempt._id;

      if (result === "succeeded") {
        contract.collectionStatus = "paid";
        contract.lastCollectionAt = attemptedAt;
        contract.nextCollectionAt = nextCollectionDate(contract.plan, dueAt);
        if (contract.status === "past_due") contract.status = "active";
      } else {
        contract.collectionStatus = "failed";
        contract.status = "past_due";
        contract.nextCollectionAt =
          retry?.retry && retry.nextRetryAt
            ? new Date(retry.nextRetryAt)
            : null;
      }

      await contract.save({ session: databaseSession });
    });
  } finally {
    await databaseSession.endSession();
  }

  return {
    contract: await getMembershipContract(contractId, { businessId }),
    collectionAttempt: attemptId
      ? await CollectionAttempt.findById(attemptId).lean()
      : null,
  };
}

export default {
  createMembershipContract,
  createMembershipPlan,
  freezeMembershipContract,
  getMembershipContract,
  listMembershipContracts,
  listMembershipPlans,
  recordMembershipCollection,
  resumeMembershipContract,
  updateMembershipContract,
  updateMembershipPlan,
};
