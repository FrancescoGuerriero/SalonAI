import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { stageSellerChannelSnapshot } from "../features/partnerMarketplace/sellerChannelSyncService.js";

// Deliberately opt-in: never connect a standard CI run to a live database.
// Only an explicitly named loopback MongoDB replica-set test database is valid.
const URI = process.env.SELLER_TXN_ACCEPTANCE_URI || "";
function safeAcceptanceUri(value) {
  if (!value) return null;
  let uri;
  try { uri = new URL(value); } catch { return null; }
  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname) ||
      uri.pathname !== "/seller_txn_acceptance" ||
      uri.username || uri.password ||
      uri.searchParams.has("authSource")) return null;
  return value;
}

test("seller source transaction commits and rolls back against a local MongoDB replica set", {
  skip: !URI ? "Set SELLER_TXN_ACCEPTANCE_URI to a loopback replica set test database" : false,
  timeout: 45000,
}, async () => {
  const checkedUri = safeAcceptanceUri(URI);
  assert.ok(checkedUri, "Refusing any non-loopback, authenticated or non-acceptance MongoDB URI");
  const db = await mongoose.createConnection(checkedUri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 12000,
  }).asPromise();
  const prefix = "seller_accept_" + randomUUID().replaceAll("-", "");
  const names = ["staging", "checkpoints", "journal", "audits"].map((name) => `${prefix}_${name}`);
  const businessId = "507f1f77bcf86cd799439021";
  const actorId = "507f1f77bcf86cd799439024";
  const connection = {
    _id: "507f1f77bcf86cd799439025", business: businessId,
    provider: "ebay", status: "connected",
  };
  try {
    // MongoDB must not implicitly create collections inside this transaction.
    for (const name of names) await db.createCollection(name);
    const [staging, checkpoint, journal, audit] = names.map((name) => db.db.collection(name));
    await staging.createIndex({ business: 1, connection: 1, kind: 1, externalId: 1 }, { unique: true });
    await checkpoint.createIndex({ business: 1, connection: 1, kind: 1 }, { unique: true });

    const runModel = {
      findOne: (filter) => ({
        select: () => ({
          sort: () => ({
            lean: async () => journal.findOne(filter, { sort: { startedAt: -1, _id: -1 } }),
          }),
        }),
      }),
      create: (record) => journal.insertOne(record),
      updateOne: (filter, change, options = {}) => journal.updateOne(filter, change, options),
    };
    const leaseModel = {
      create: async () => {},
      findOneAndUpdate: async () => ({ owner: "test-lease-owned" }),
      deleteOne: async () => {},
    };
    const recordsModel = {
      bulkWrite: (operations, options) => staging.bulkWrite(operations, options),
    };
    let failCheckpoint = false;
    const checkpointModel = {
      findOneAndUpdate: async (filter, change, options) => {
        if (failCheckpoint) throw new Error("injected-checkpoint-failure");
        return checkpoint.findOneAndUpdate(filter, change, options);
      },
    };
    const auditModel = {
      create: (docs, options) => audit.insertMany(docs, options),
    };
    const common = {
      businessId, actorId, atomicStaging: true,
      startSession: () => db.startSession(),
      runModel, leaseModel, recordsModel, checkpointModel, auditModel,
    };

    const first = await stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [{ sku: "SKU-COMMITTED", quantity: 5 }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    });
    assert.equal(first.canonicalRecordsWritten, 0);
    assert.equal(await staging.countDocuments({ business: businessId }), 1);
    assert.equal(await checkpoint.countDocuments({ business: businessId }), 1);
    assert.equal(await audit.countDocuments({}), 1);
    assert.equal(await journal.countDocuments({ state: "completed" }), 1);

    failCheckpoint = true;
    await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [{ sku: "SKU-ROLLED-BACK", quantity: 9 }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    }), /injected-checkpoint-failure/);
    assert.equal(await staging.countDocuments({ externalId: "SKU-ROLLED-BACK" }), 0);
    assert.equal(await staging.countDocuments({ business: businessId }), 1);
    assert.equal(await checkpoint.countDocuments({ business: businessId }), 1);
    assert.equal(await audit.countDocuments({}), 1);
    assert.equal(await journal.countDocuments({ state: "failed", failureClass: "checkpoint" }), 1);
  } finally {
    // Delete only randomly named collections created by this test.
    for (const name of names) {
      try { await db.db.dropCollection(name); } catch (error) {
        if (error?.codeName !== "NamespaceNotFound") throw error;
      }
    }
    await db.close();
  }
});
