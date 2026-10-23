import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import AiPrediction from "./AiPrediction.js";
import * as aiService from "./aiService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return String(value);
}

function integer(value, fallback, min = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function customerForBusiness(customerId, businessId) {
  objectId(customerId, "customer");
  objectId(businessId, "business");
  return assertFound(
    await Customer.findOne({
      _id: customerId,
      business: businessId,
      status: { $ne: "deleted" },
    }).lean(),
    "Customer was not found in the active business."
  );
}

async function customerIdsForBusiness(query = {}, businessId) {
  objectId(businessId, "business");
  const match = {
    business: businessId,
    status: { $ne: "deleted" },
  };

  if (query.status && query.status !== "all") {
    match.status = text(query.status).toLowerCase();
  }
  if (query.customer) {
    match._id = objectId(query.customer, "customer");
  }
  if (Array.isArray(query.customerIds) && query.customerIds.length > 0) {
    const ids = [
      ...new Set(
        query.customerIds
          .map(String)
          .filter((value) => mongoose.isValidObjectId(value))
      ),
    ];
    if (ids.length === 0) {
      throw createServiceError("No valid customer identifiers were supplied.", 400);
    }
    match._id = { $in: ids };
  }

  const search = text(query.search || query.q);
  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    match.$or = [
      { firstName: pattern },
      { lastName: pattern },
      { preferredName: pattern },
      { email: pattern },
      { phone: pattern },
    ];
  }

  return Customer.find(match).distinct("_id");
}

export async function predictTenantRetention(
  customerId,
  options = {},
  { businessId } = {}
) {
  await customerForBusiness(customerId, businessId);
  return aiService.predictRetention(customerId, options);
}

export async function getTenantStoredRetentionPrediction(
  customerId,
  { businessId } = {}
) {
  await customerForBusiness(customerId, businessId);
  return aiService.getStoredRetentionPrediction(customerId);
}

export async function predictTenantRetentionBatch(
  payload = {},
  { businessId } = {}
) {
  const customerIds = await customerIdsForBusiness(
    {
      customerIds: payload.customerIds,
      status: payload.status || "active",
    },
    businessId
  );

  // The legacy engine interprets an empty ID list as a global status query.
  // Never call it with an empty tenant cohort.
  if (customerIds.length === 0) {
    return {
      requested: 0,
      succeeded: 0,
      failed: 0,
      refreshed: 0,
      reused: 0,
      results: [],
    };
  }

  return aiService.predictRetentionBatch({
    ...payload,
    customerIds: customerIds.map(String),
  });
}

export async function listTenantRetentionPredictions(
  query = {},
  { businessId } = {}
) {
  const page = integer(query.page, 1, 1, 1000000);
  const limit = integer(query.limit, 25, 1, 100);
  const customerIds = await customerIdsForBusiness(query, businessId);
  const match = {
    predictionType: "churn_risk",
    customer: { $in: customerIds },
  };

  if (query.label && query.label !== "all") {
    const label = text(query.label).toLowerCase();
    if (!["low", "medium", "high"].includes(label)) {
      throw createServiceError("Risk label must be low, medium or high.", 400);
    }
    match.label = label;
  }
  if (query.minScore !== undefined || query.maxScore !== undefined) {
    match.score = {};
    if (query.minScore !== undefined) match.score.$gte = clamp(query.minScore);
    if (query.maxScore !== undefined) match.score.$lte = clamp(query.maxScore);
  }
  if (String(query.includeExpired).toLowerCase() !== "true") {
    match.expiresAt = { $gt: new Date() };
  }

  const sort =
    query.sort === "oldest"
      ? { updatedAt: 1 }
      : query.sort === "newest"
        ? { updatedAt: -1 }
        : { score: -1, updatedAt: -1 };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AiPrediction.find(match)
      .populate(
        "customer",
        "firstName lastName preferredName email phone status totalSpent loyaltyTier membershipStatus lastVisit nextAppointment"
      )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    AiPrediction.countDocuments(match),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      fresh: Boolean(item.expiresAt && new Date(item.expiresAt) > new Date()),
      riskFactors: item.features?.riskFactors || [],
      recommendedActions: item.features?.recommendedActions || [],
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getTenantRetentionSummary({ businessId } = {}) {
  objectId(businessId, "business");
  const now = new Date();
  const [allCustomerIds, activeCustomerIds] = await Promise.all([
    Customer.find({
      business: businessId,
      status: { $ne: "deleted" },
    }).distinct("_id"),
    Customer.find({
      business: businessId,
      status: "active",
    }).distinct("_id"),
  ]);
  const match = {
    predictionType: "churn_risk",
    customer: { $in: allCustomerIds },
  };

  const [grouped, stale, topRisk] = await Promise.all([
    AiPrediction.aggregate([
      { $match: { ...match, expiresAt: { $gt: now } } },
      {
        $group: {
          _id: "$label",
          count: { $sum: 1 },
          averageScore: { $avg: "$score" },
        },
      },
    ]),
    AiPrediction.countDocuments({
      ...match,
      expiresAt: { $lte: now },
    }),
    AiPrediction.find({
      ...match,
      expiresAt: { $gt: now },
    })
      .populate(
        "customer",
        "firstName lastName preferredName email phone status totalSpent lastVisit nextAppointment"
      )
      .sort({ score: -1 })
      .limit(10)
      .lean(),
  ]);

  const byRisk = {
    low: { count: 0, averageScore: 0 },
    medium: { count: 0, averageScore: 0 },
    high: { count: 0, averageScore: 0 },
  };
  for (const row of grouped) {
    if (byRisk[row._id]) {
      byRisk[row._id] = {
        count: row.count,
        averageScore: Math.round((Number(row.averageScore) || 0) * 1000) / 1000,
      };
    }
  }
  const predictedCustomers = Object.values(byRisk).reduce(
    (sum, item) => sum + item.count,
    0
  );

  return {
    totalCustomers: activeCustomerIds.length,
    predictedCustomers,
    coverageRate:
      activeCustomerIds.length > 0
        ? Math.round((predictedCustomers / activeCustomerIds.length) * 1000) / 1000
        : 0,
    stalePredictions: stale,
    byRisk,
    topRisk: topRisk.map((prediction) => ({
      ...prediction,
      riskFactors: prediction.features?.riskFactors || [],
      recommendedActions: prediction.features?.recommendedActions || [],
    })),
    generatedAt: now,
  };
}

export default {
  getTenantRetentionSummary,
  getTenantStoredRetentionPrediction,
  listTenantRetentionPredictions,
  predictTenantRetention,
  predictTenantRetentionBatch,
};
