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

test("seller transaction acceptance refuses remote databases and credentialed URIs", () => {
  for (const value of [
    "mongodb://example.com:27017/seller_txn_acceptance",
    "mongodb://localhost:27017/production",
    "mongodb://admin:secret@localhost:27017/seller_txn_acceptance",
    "mongodb://localhost:27017/seller_txn_acceptance?authSource=admin",
    "https://localhost/seller_txn_acceptance",
  ]) assert.equal(safeAcceptanceUri(value), null);
  assert.equal(safeAcceptanceUri("mongodb://127.0.0.1:27017/seller_txn_acceptance"),
    "mongodb://127.0.0.1:27017/seller_txn_acceptance");
});

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
    let failAudit = false;
    const auditModel = {
      create: (docs, options) => {
        if (failAudit) throw new Error("injected-audit-failure");
        return audit.insertMany(docs, options);
      },
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
    const committedCheckpoint = await checkpoint.findOne({ business: businessId });
    const committedRecord = await staging.findOne({ externalId: "SKU-COMMITTED" });

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
    assert.deepEqual(await checkpoint.findOne({ business: businessId }), committedCheckpoint);

    // Audit failure happens after the source upsert and checkpoint update.
    // Neither the new listing nor changes to a previously committed listing
    // may survive an aborted transaction.
    failCheckpoint = false;
    failAudit = true;
    await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      recoveryAcknowledged: true,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [
          { sku: "SKU-COMMITTED", quantity: 999 },
          { sku: "SKU-AUDIT-ROLLED-BACK", quantity: 3 },
        ],
        nextPageAvailable: false, pagesFetched: 2, completeWithinLimit: true,
      }),
    }), /injected-audit-failure/);
    assert.equal(await staging.countDocuments({ externalId: "SKU-AUDIT-ROLLED-BACK" }), 0);
    assert.deepEqual(await staging.findOne({ externalId: "SKU-COMMITTED" }), committedRecord);
    assert.deepEqual(await checkpoint.findOne({ business: businessId }), committedCheckpoint);
    assert.equal(await audit.countDocuments({}), 1);
    assert.equal(await journal.countDocuments({ state: "completed" }), 1);
    assert.equal(await journal.countDocuments({ state: "failed" }), 2);

    // Simulate a server-labeled transient error after the first attempt has
    // written its staged source record but before the checkpoint completes.
    // The driver's withTransaction implementation must abort and rerun the
    // transaction body, leaving only one committed record, checkpoint,
    // audit and completed journal for this import.
    failAudit = false;
    let transientAttempts = 0;
    const transientCheckpointModel = {
      findOneAndUpdate: async (filter, change, options) => {
        transientAttempts++;
        if (transientAttempts === 1) {
          // The MongoDB driver retries only native MongoError instances
          // bearing TransientTransactionError, not arbitrary JavaScript Errors.
          const error = new mongoose.mongo.MongoServerError({
            ok: 0, code: 112, codeName: "WriteConflict",
            errmsg: "injected-transient-transaction-error",
          });
          error.addErrorLabel("TransientTransactionError");
          throw error;
        }
        return checkpoint.findOneAndUpdate(filter, change, options);
      },
    };
    const recovered = await stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      checkpointModel: transientCheckpointModel,
      recoveryAcknowledged: true,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [{ sku: "SKU-TRANSIENT-RETRIED", quantity: 7 }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    });
    assert.equal(recovered.canonicalRecordsWritten, 0);
    assert.equal(transientAttempts, 2);
    assert.equal(await staging.countDocuments({ externalId: "SKU-TRANSIENT-RETRIED" }), 1);
    assert.equal(await staging.countDocuments({ business: businessId }), 2);
    assert.equal(await checkpoint.countDocuments({ business: businessId }), 1);
    assert.equal(await audit.countDocuments({}), 2);
    assert.equal(await journal.countDocuments({ state: "completed" }), 2);
    assert.equal(await journal.countDocuments({ state: "failed" }), 2);

    // Simulate the client losing the commit acknowledgement *after* a real
    // replica-set commit. The transaction's completed journal must win over
    // the diagnostic error handler; a replay must not be forced.
    const unknownCommitError = () => {
      const error = new mongoose.mongo.MongoServerError({
        ok: 0, code: 64, codeName: "WriteConcernFailed",
        errmsg: "injected-commit-acknowledgement-loss",
      });
      error.addErrorLabel("UnknownTransactionCommitResult");
      return error;
    };
    const committedButUnacknowledged = async () => {
      const session = await db.startSession();
      return {
        withTransaction: async (callback) => {
          await session.withTransaction(callback);
          throw unknownCommitError();
        },
        endSession: () => session.endSession(),
      };
    };
    await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      recoveryAcknowledged: true,
      startSession: committedButUnacknowledged,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [{ sku: "SKU-COMMIT-ACK-LOST", quantity: 11 }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    }), /injected-commit-acknowledgement-loss/);
    assert.equal(await staging.countDocuments({ externalId: "SKU-COMMIT-ACK-LOST" }), 1);
    assert.equal(await staging.countDocuments({ business: businessId }), 3);
    assert.equal(await checkpoint.countDocuments({ business: businessId }), 1);
    assert.equal(await audit.countDocuments({}), 3);
    assert.equal(await journal.countDocuments({ state: "completed" }), 3);
    assert.equal(await journal.countDocuments({ state: "commit_unknown" }), 0);

    // When no commit can be established, the journal is commit_unknown and
    // neither automatic retry nor checkpoint resume may proceed.
    const noCommitReply = async () => ({
      withTransaction: async () => { throw unknownCommitError(); },
      endSession: async () => {},
    });
    await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      startSession: noCommitReply,
      readSnapshot: async () => ({
        provider: "ebay", kind: "listings",
        records: [{ sku: "SKU-UNRESOLVED", quantity: 13 }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    }), /injected-commit-acknowledgement-loss/);
    assert.equal(await staging.countDocuments({ externalId: "SKU-UNRESOLVED" }), 0);
    assert.equal(await checkpoint.countDocuments({ business: businessId }), 1);
    assert.equal(await audit.countDocuments({}), 3);
    assert.equal(await journal.countDocuments({ state: "commit_unknown" }), 1);

    let attemptedFetch = false;
    await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
      ...common,
      readSnapshot: async () => {
        attemptedFetch = true;
        throw new Error("must not fetch an unreviewed retry");
      },
    }), { code: "SELLER_RECOVERY_REVIEW_REQUIRED" });
    assert.equal(attemptedFetch, false);
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
