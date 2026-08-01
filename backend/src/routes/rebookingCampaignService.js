import LoyaltyAccount from "./LoyaltyAccount.js";
import Membership from "./Membership.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import { userId } from "../../shared/modelHelpers.js";

function tierForPoints(points) {
  if (points >= 5000) {
    return "platinum";
  }

  if (points >= 2500) {
    return "gold";
  }

  if (points >= 1000) {
    return "silver";
  }

  return "standard";
}

export async function getAccount(customerId) {
  return LoyaltyAccount.findOneAndUpdate(
    {
      customer: customerId,
    },
    {
      $setOnInsert: {
        customer: customerId,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export async function transact(
  customerId,
  payload,
  user
) {
  const allowed = [
    "earn",
    "redeem",
    "adjust",
    "expire",
  ];

  if (!allowed.includes(payload.type)) {
    throw createServiceError(
      "Invalid loyalty transaction type.",
      400
    );
  }

  const points = Number(payload.points);

  if (!Number.isFinite(points) || points === 0) {
    throw createServiceError(
      "A non-zero points value is required.",
      400
    );
  }

  const account =
    await LoyaltyAccount.findOneAndUpdate(
      {
        customer: customerId,
      },
      {
        $setOnInsert: {
          customer: customerId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

  const signedPoints =
    ["redeem", "expire"].includes(payload.type)
      ? -Math.abs(points)
      : payload.type === "earn"
        ? Math.abs(points)
        : points;

  if (
    account.pointsBalance + signedPoints <
    0
  ) {
    throw createServiceError(
      "The customer does not have enough loyalty points.",
      409
    );
  }

  account.pointsBalance += signedPoints;

  if (signedPoints > 0) {
    account.lifetimePoints += signedPoints;
  }

  account.tier = tierForPoints(
    account.lifetimePoints
  );

  account.transactions.push({
    type: payload.type,
    points: signedPoints,
    reason: String(payload.reason || "").trim(),
    appointment: payload.appointment,
    order: payload.order,
    createdBy: userId(user),
  });

  await account.save();

  return account.toObject();
}

export async function createMembership(payload) {
  if (
    !payload.customer ||
    !payload.planName ||
    payload.price === undefined
  ) {
    throw createServiceError(
      "Customer, plan name and price are required.",
      400
    );
  }

  return Membership.create({
    customer: payload.customer,
    planName: String(payload.planName).trim(),
    status: payload.status || "active",
    billingFrequency:
      payload.billingFrequency || "monthly",
    price: Number(payload.price),
    benefits: Array.isArray(payload.benefits)
      ? payload.benefits
      : [],
    startsAt: payload.startsAt || new Date(),
    renewsAt: payload.renewsAt,
    endsAt: payload.endsAt,
    paymentProviderSubscriptionId:
      payload.paymentProviderSubscriptionId,
  });
}

export async function listMemberships(
  query = {}
) {
  const match = {};

  if (query.customer) {
    match.customer = query.customer;
  }

  if (query.status) {
    match.status = query.status;
  }

  return Membership.find(match)
    .populate(
      "customer",
      "firstName lastName fullName name email"
    )
    .sort({ createdAt: -1 })
    .lean();
}

export async function updateMembership(
  id,
  payload
) {
  const membership = assertFound(
    await Membership.findById(id),
    "Membership not found."
  );

  for (const field of [
    "planName",
    "status",
    "billingFrequency",
    "price",
    "benefits",
    "startsAt",
    "renewsAt",
    "endsAt",
    "paymentProviderSubscriptionId",
  ]) {
    if (payload[field] !== undefined) {
      membership[field] = payload[field];
    }
  }

  await membership.save();

  return membership.toObject();
}
