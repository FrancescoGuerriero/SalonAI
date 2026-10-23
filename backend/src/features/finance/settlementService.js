import { createHash } from "node:crypto";
import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import CrossLocationObligation from "../../models/CrossLocationObligation.js";
import SettlementBatch from "../../models/SettlementBatch.js";
import StoredValueLedgerEntry from "../../models/StoredValueLedgerEntry.js";
import StoredValueProgram from "../../models/StoredValueProgram.js";
import {
  planInterLocationSettlement,
} from "../../platform/finance/storedValueLedger.js";
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
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated settlement operator is required.", 401);
  }
  return value;
}

function assertBusiness(businessId) {
  return objectId(businessId, "business");
}

function batchFingerprint({ businessId, currency, obligations }) {
  const payload = {
    businessId: String(businessId),
    currency,
    obligations: obligations
      .map((item) => ({
        id: String(item._id),
        fingerprint: item.settlementFingerprint,
        amount: Number(item.amount),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function programForEntry(entry) {
  return assertFound(
    await StoredValueProgram.findOne({
      _id: entry.program,
      business: entry.business,
    }).lean(),
    "Stored-value programme not found for settlement projection."
  );
}

export async function projectStoredValueSettlement(
  ledgerEntryId,
  { businessId } = {}
) {
  assertBusiness(businessId);
  objectId(ledgerEntryId, "ledgerEntry");
  const entry = assertFound(
    await StoredValueLedgerEntry.findOne({
      _id: ledgerEntryId,
      business: businessId,
    }).lean(),
    "Stored-value ledger entry not found."
  );

  if (entry.eventType !== "redeem") {
    return {
      projected: false,
      reason: "not-redemption",
      ledgerEntryId: String(entry._id),
    };
  }
  if (entry.unit !== "money") {
    return {
      projected: false,
      reason: "non-money-unit",
      ledgerEntryId: String(entry._id),
    };
  }

  const program = await programForEntry(entry);
  const plan = planInterLocationSettlement({
    businessId: String(entry.business),
    liabilityPolicy: program.liabilityPolicy,
    settlementPolicy: program.settlementPolicy,
    saleLocationId: entry.saleLocation ? String(entry.saleLocation) : "",
    redemptionLocationId: entry.redemptionLocation
      ? String(entry.redemptionLocation)
      : "",
    amount: Math.abs(Number(entry.delta)),
    currency: entry.currency || program.currency || "GBP",
    sourceLedgerEntryId: String(entry._id),
    idempotencyKey: `stored-value-settlement:${entry._id}:${entry.ledgerFingerprint}`,
  });

  if (!plan.required) {
    return {
      projected: false,
      reason: plan.reason,
      ledgerEntryId: String(entry._id),
    };
  }

  const initialStatus =
    plan.settlementPolicy === "manual-review" ? "pending_review" : "open";
  const obligation = await CrossLocationObligation.findOneAndUpdate(
    {
      business: businessId,
      sourceLedgerEntry: entry._id,
    },
    {
      $setOnInsert: {
        business: businessId,
        program: program._id,
        sourceLedgerEntry: entry._id,
        sourceLedgerFingerprint: entry.ledgerFingerprint,
        sourceOccurredAt: entry.occurredAt,
        fromLocation: plan.fromLocationId,
        toLocation: plan.toLocationId,
        amount: plan.amount,
        currency: plan.currency,
        settlementPolicy: plan.settlementPolicy,
        payable: {
          location: plan.fromLocationId,
          amount: plan.amount,
        },
        receivable: {
          location: plan.toLocationId,
          amount: plan.amount,
        },
        status: initialStatus,
        settlementFingerprint: plan.settlementFingerprint,
        metadata: {
          projectionSource: "stored-value-ledger",
          liabilityPolicy: program.liabilityPolicy,
          sourceEventType: entry.eventType,
          paymentExecutionAllowed: false,
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
    projected: true,
    obligation,
    createdOrReused: true,
  };
}

export async function projectPendingStoredValueSettlements(
  query = {},
  { businessId } = {}
) {
  assertBusiness(businessId);
  const limit = Math.max(1, Math.min(500, Number(query.limit) || 100));
  const match = {
    business: businessId,
    eventType: "redeem",
    unit: "money",
    saleLocation: { $ne: null },
    redemptionLocation: { $ne: null },
  };
  if (query.since) {
    const since = new Date(query.since);
    if (Number.isNaN(since.getTime())) {
      throw createServiceError("since must be a valid date.", 400, {
        field: "since",
      });
    }
    match.occurredAt = { $gte: since };
  }

  const entries = await StoredValueLedgerEntry.find(match)
    .sort({ occurredAt: 1, _id: 1 })
    .limit(limit)
    .select("_id")
    .lean();
  const results = [];
  for (const entry of entries) {
    results.push(
      await projectStoredValueSettlement(entry._id, { businessId })
    );
  }
  return {
    scanned: entries.length,
    projected: results.filter((item) => item.projected).length,
    results,
  };
}

export async function listCrossLocationObligations(
  query = {},
  { businessId } = {}
) {
  assertBusiness(businessId);
  const match = { business: businessId };
  if (query.status) match.status = text(query.status).toLowerCase();
  if (query.currency) match.currency = text(query.currency).toUpperCase();
  if (query.fromLocation) {
    match.fromLocation = objectId(query.fromLocation, "fromLocation");
  }
  if (query.toLocation) {
    match.toLocation = objectId(query.toLocation, "toLocation");
  }

  return CrossLocationObligation.find(match)
    .populate("program", "key programType liabilityPolicy settlementPolicy")
    .populate("fromLocation", "name")
    .populate("toLocation", "name")
    .sort({ sourceOccurredAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(500, Number(query.limit) || 100)))
    .lean();
}

export async function reviewCrossLocationObligation(
  obligationId,
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  assertBusiness(businessId);
  objectId(obligationId, "obligation");
  const actor = actorId(user);
  const obligation = assertFound(
    await CrossLocationObligation.findOne({
      _id: obligationId,
      business: businessId,
      status: "pending_review",
    }),
    "Pending-review settlement obligation not found."
  );
  const decision = text(payload.decision).toLowerCase();
  if (!["approved", "rejected"].includes(decision)) {
    throw createServiceError("decision must be approved or rejected.", 400, {
      field: "decision",
    });
  }

  obligation.status = decision === "approved" ? "open" : "rejected";
  obligation.reviewedBy = actor;
  obligation.reviewedAt = new Date();
  obligation.reviewNote = text(payload.note);
  await obligation.save();

  await AuditLog.create({
    actor,
    action: "finance.cross_location_obligation_reviewed",
    resourceType: "CrossLocationObligation",
    resourceId: String(obligation._id),
    requestId: text(requestId),
    after: {
      status: obligation.status,
      decision,
    },
    metadata: {
      businessId: String(businessId),
      paymentExecutionAllowed: false,
    },
  });
  return obligation.toObject();
}

export async function createSettlementBatch(
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  assertBusiness(businessId);
  const actor = actorId(user);
  const ids = [
    ...new Set(
      (Array.isArray(payload.obligationIds) ? payload.obligationIds : [])
        .map(String)
        .filter((value) => mongoose.isValidObjectId(value))
    ),
  ];
  if (!ids.length) {
    throw createServiceError("At least one open obligation is required.", 400, {
      field: "obligationIds",
    });
  }

  const obligations = await CrossLocationObligation.find({
    _id: { $in: ids },
    business: businessId,
    status: "open",
    settlementBatch: null,
  })
    .sort({ sourceOccurredAt: 1, _id: 1 })
    .lean();
  if (obligations.length !== ids.length) {
    throw createServiceError(
      "Every selected obligation must belong to the active Business and be open/unbatched.",
      409
    );
  }

  const currencies = [...new Set(obligations.map((item) => item.currency))];
  if (currencies.length !== 1) {
    throw createServiceError("A settlement batch may contain one currency only.", 409);
  }
  const currency = currencies[0];
  const totalAmount =
    Math.round(
      obligations.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100
    ) / 100;
  const fingerprint = batchFingerprint({
    businessId,
    currency,
    obligations,
  });
  const existing = await SettlementBatch.findOne({
    business: businessId,
    settlementFingerprint: fingerprint,
  }).lean();
  if (existing) return existing;

  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      [created] = await SettlementBatch.create(
        [
          {
            business: businessId,
            currency,
            status: "draft",
            obligations: obligations.map((item) => item._id),
            obligationCount: obligations.length,
            totalAmount,
            period: {
              from: obligations[0].sourceOccurredAt,
              to: obligations[obligations.length - 1].sourceOccurredAt,
            },
            settlementFingerprint: fingerprint,
            paymentExecutionAllowed: false,
            createdBy: actor,
            metadata: {
              reconciliationOnly: true,
              externalPaymentInitiated: false,
            },
          },
        ],
        { session }
      );

      const result = await CrossLocationObligation.updateMany(
        {
          _id: { $in: obligations.map((item) => item._id) },
          business: businessId,
          status: "open",
          settlementBatch: null,
        },
        {
          $set: {
            status: "batched",
            settlementBatch: created._id,
          },
        },
        { session }
      );
      if (result.modifiedCount !== obligations.length) {
        throw createServiceError(
          "Settlement obligations changed while the batch was being created.",
          409,
          { code: "SETTLEMENT_BATCH_CONCURRENT_CHANGE" }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await AuditLog.create({
    actor,
    action: "finance.settlement_batch_created",
    resourceType: "SettlementBatch",
    resourceId: String(created._id),
    requestId: text(requestId),
    after: {
      status: created.status,
      obligationCount: created.obligationCount,
      totalAmount: created.totalAmount,
      currency: created.currency,
    },
    metadata: {
      businessId: String(businessId),
      paymentExecutionAllowed: false,
      reconciliationOnly: true,
    },
  });

  return created.toObject();
}

export async function reviewSettlementBatch(
  batchId,
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  assertBusiness(businessId);
  objectId(batchId, "settlementBatch");
  const actor = actorId(user);
  const batch = assertFound(
    await SettlementBatch.findOne({
      _id: batchId,
      business: businessId,
      status: "draft",
    }),
    "Draft settlement batch not found."
  );
  const decision = text(payload.decision).toLowerCase();
  if (!["review_ready", "void"].includes(decision)) {
    throw createServiceError("decision must be review_ready or void.", 400, {
      field: "decision",
    });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      batch.status = decision;
      batch.reviewedBy = actor;
      batch.reviewedAt = new Date();
      batch.reviewNote = text(payload.note);
      await batch.save({ session });

      if (decision === "void") {
        await CrossLocationObligation.updateMany(
          {
            business: businessId,
            settlementBatch: batch._id,
            status: "batched",
          },
          {
            $set: {
              status: "open",
              settlementBatch: null,
            },
          },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await AuditLog.create({
    actor,
    action: "finance.settlement_batch_reviewed",
    resourceType: "SettlementBatch",
    resourceId: String(batch._id),
    requestId: text(requestId),
    after: {
      status: batch.status,
      paymentExecutionAllowed: false,
    },
    metadata: {
      businessId: String(businessId),
      externalPaymentInitiated: false,
    },
  });
  return batch.toObject();
}

export async function listSettlementBatches(
  query = {},
  { businessId } = {}
) {
  assertBusiness(businessId);
  const match = { business: businessId };
  if (query.status) match.status = text(query.status).toLowerCase();
  if (query.currency) match.currency = text(query.currency).toUpperCase();
  return SettlementBatch.find(match)
    .populate("obligations")
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 50)))
    .lean();
}

export async function settlementReconciliationSummary({ businessId } = {}) {
  assertBusiness(businessId);
  const rows = await CrossLocationObligation.aggregate([
    { $match: { business: new mongoose.Types.ObjectId(businessId) } },
    {
      $group: {
        _id: {
          status: "$status",
          currency: "$currency",
          fromLocation: "$fromLocation",
          toLocation: "$toLocation",
        },
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.currency": 1, "_id.status": 1 } },
  ]);
  return {
    businessId: String(businessId),
    paymentExecutionAllowed: false,
    reconciliationOnly: true,
    rows,
  };
}

export default {
  createSettlementBatch,
  listCrossLocationObligations,
  listSettlementBatches,
  projectPendingStoredValueSettlements,
  projectStoredValueSettlement,
  reviewCrossLocationObligation,
  reviewSettlementBatch,
  settlementReconciliationSummary,
};
