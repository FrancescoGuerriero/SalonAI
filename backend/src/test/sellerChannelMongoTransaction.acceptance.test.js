import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { stageSellerChannelSnapshot } from "../features/partnerMarketplace/sellerChannelSyncService.js";
import { inspectSellerChannelOrderStates } from "../features/partnerMarketplace/sellerChannelOrderStateInspection.js";
import SellerChannelOrderLink from "../models/SellerChannelOrderLink.js";
import { inspectSellerCommerceOrderOwnership } from "../features/partnerMarketplace/sellerChannelCommerceOwnership.js";

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
      const performTransaction = session.withTransaction.bind(session);
      // The driver receives an actual ClientSession for collection writes;
      // only its transaction acknowledgement is fault-injected.
      session.withTransaction = async (callback) => {
        await performTransaction(callback);
        throw unknownCommitError();
      };
      return session;
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
    const noCommitReply = async () => {
      const session = await db.startSession();
      session.withTransaction = async () => { throw unknownCommitError(); };
      return session;
    };
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
    }), (error) => error.statusCode === 409 &&
      error.details?.code === "SELLER_RECOVERY_REVIEW_REQUIRED");
    assert.equal(attemptedFetch, false);

    // Order observations use the same atomic boundaries but never create
    // Commerce orders, charge payments or trigger fulfilment.
    const stagedOrder = await stageSellerChannelSnapshot(connection, "orders", {
      ...common,
      readSnapshot: async () => ({
        provider: "ebay", kind: "orders",
        records: [{
          externalOrderId: "EB-ORDER-COMMITTED", status: "NOT_STARTED",
          fulfillmentStatus: "NOT_STARTED", total: "19.95", currency: "GBP",
          placedAt: "2026-11-10T11:00:00Z",
        }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    });
    assert.equal(stagedOrder.canonicalRecordsWritten, 0);
    assert.equal(stagedOrder.fulfillmentWritesEnabled, false);
    const committedOrder = await staging.findOne({
      business: businessId, kind: "orders", externalId: "EB-ORDER-COMMITTED",
    });
    assert.equal(committedOrder.sourceRecord.status, "NOT_STARTED");
    assert.equal(committedOrder.sourceRecord.fulfillmentStatus, "NOT_STARTED");
    assert.equal(committedOrder.sourceRecord.amount, "19.95");
    assert.equal(committedOrder.sourceRecord.currency, "GBP");
    const orderCheckpoint = await checkpoint.findOne({ business: businessId, kind: "orders" });
    assert.ok(orderCheckpoint);
    assert.equal(await audit.countDocuments({ "metadata.kind": "orders" }), 1);

    failAudit = true;
    await assert.rejects(stageSellerChannelSnapshot(connection, "orders", {
      ...common,
      readSnapshot: async () => ({
        provider: "ebay", kind: "orders",
        records: [{
          externalOrderId: "EB-ORDER-ROLLBACK", status: "FULFILLED",
          fulfillmentStatus: "FULFILLED", total: "50.00", currency: "GBP",
        }],
        nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
      }),
    }), /injected-audit-failure/);
    assert.equal(await staging.countDocuments({
      business: businessId, kind: "orders", externalId: "EB-ORDER-ROLLBACK",
    }), 0);
    assert.deepEqual(await checkpoint.findOne({ business: businessId, kind: "orders" }),
      orderCheckpoint);
    assert.equal(await audit.countDocuments({ "metadata.kind": "orders" }), 1);
    assert.equal(await journal.countDocuments({ state: "failed", kind: "orders" }), 1);
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

test("real MongoDB staged seller order inspection preserves tenant boundaries and read-only state", {
  skip: !URI ? "Set SELLER_TXN_ACCEPTANCE_URI to a loopback replica set test database" : false,
  timeout: 30000,
}, async () => {
  const checkedUri = safeAcceptanceUri(URI);
  assert.ok(checkedUri, "Refusing any non-loopback or non-acceptance MongoDB URI");
  const db = await mongoose.createConnection(checkedUri, {
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 12000,
  }).asPromise();
  const collectionName = "seller_order_inspection_" + randomUUID().replaceAll("-", "");
  const businessId = "507f1f77bcf86cd799439021";
  const foreignId = "507f1f77bcf86cd799439099";
  const connectionId = "507f1f77bcf86cd799439025";
  const otherConnectionId = "507f1f77bcf86cd799439026";
  try {
    await db.createCollection(collectionName);
    const collection = db.db.collection(collectionName);
    const record = (business, connection, externalId, status = "FULFILLED") => ({
      business, connection, provider: "ebay", kind: "orders", externalId,
      sourceRecord: { status, fulfillmentStatus: status },
      lastObservedAt: new Date("2026-11-16T09:00:00Z"),
    });
    await collection.insertMany([
      record(businessId, connectionId, "VISIBLE-ORDER"),
      record(foreignId, connectionId, "FOREIGN-TENANT-ORDER"),
      record(businessId, otherConnectionId, "OTHER-CONNECTION-ORDER"),
      { ...record(businessId, connectionId, "LISTING-ONLY"), kind: "listings" },
    ]);
    const calls = [];
    const stagedModel = {
      find(filter) {
        calls.push(filter);
        return {
          sort(specification) {
            return {
              limit(limit) {
                return { lean: () => collection.find(filter)
                  .sort(specification).limit(limit).toArray() };
              },
            };
          },
        };
      },
    };
    const connection = {
      _id: connectionId, business: businessId,
      provider: "ebay", status: "connected",
    };
    const options = { businessId, locationAccessMode: "all", stagedModel };
    const before = await collection.countDocuments({});
    const report = await inspectSellerChannelOrderStates(connection, options);
    assert.deepEqual(report.records.map((entry) => entry.externalOrderId), ["VISIBLE-ORDER"]);
    assert.equal(report.records[0].reviewState, "observation_only");
    assert.equal(report.inspectedCount, 1);
    assert.equal(report.refundsIssued, 0);
    assert.equal(report.fulfillmentWrites, 0);
    assert.equal(report.canonicalRecordsWritten, 0);
    assert.equal(report.readOnly, true);
    assert.equal(await collection.countDocuments({}), before);
    assert.deepEqual(calls[0], {
      business: businessId, connection: connectionId,
      provider: "ebay", kind: "orders",
    });

    const queryCount = calls.length;
    await assert.rejects(inspectSellerChannelOrderStates(connection, {
      ...options, locationAccessMode: "selected",
    }), (error) => error.details?.code === "SELLER_ORDER_STATES_LOCATION_SCOPE_REQUIRED");
    await assert.rejects(inspectSellerChannelOrderStates(connection, {
      ...options, businessId: foreignId,
    }), (error) => error.details?.code === "SELLER_ORDER_STATES_TENANT_REQUIRED");
    assert.equal(calls.length, queryCount, "rejected authority must never reach MongoDB");
    assert.equal(await collection.countDocuments({}), before);
  } finally {
    try { await db.db.dropCollection(collectionName); } catch (error) {
      if (error?.codeName !== "NamespaceNotFound") throw error;
    }
    await db.close();
  }
});


test("MongoDB enforces seller order-link uniqueness without changing Commerce orders", {
  skip: !URI ? "Set SELLER_TXN_ACCEPTANCE_URI to a loopback replica set test database" : false,
  timeout: 45000,
}, async () => {
  const checkedUri = safeAcceptanceUri(URI);
  assert.ok(checkedUri, "Refusing any non-loopback or non-acceptance MongoDB URI");
  const db = await mongoose.createConnection(checkedUri, {
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 12000,
  }).asPromise();
  const collectionName = "seller_order_link_accept_" + randomUUID().replaceAll("-", "");
  const collection = db.db.collection(collectionName);
  const businessA = new mongoose.Types.ObjectId();
  const businessB = new mongoose.Types.ObjectId();
  const connectionA = new mongoose.Types.ObjectId();
  const connectionB = new mongoose.Types.ObjectId();
  const orderA = new mongoose.Types.ObjectId();
  const orderB = new mongoose.Types.ObjectId();
  const link = (business, connection, externalOrderId, commerceOrder) => ({
    business, connection, provider: "ebay", externalOrderId,
    commerceOrder, evidenceSource: "operator_proposal",
    verificationStatus: "pending_verification",
  });
  try {
    await db.createCollection(collectionName);
    // Exercise the actual unique index declarations used by the application.
    const unique = SellerChannelOrderLink.schema.indexes().filter(([, options]) =>
      options.unique === true);
    assert.equal(unique.length, 2);
    for (const [fields, options] of unique) {
      await collection.createIndex(fields, { unique: options.unique });
    }
    const preexistingCommerceOrders = await db.db.collection("orders").countDocuments({});
    await collection.insertOne(link(businessA, connectionA, "EB-100", orderA));
    await assert.rejects(
      collection.insertOne(link(businessA, connectionA, "EB-100", orderB)),
      (error) => error.code === 11000,
      "One marketplace account/order ID must not be proposed twice",
    );
    await assert.rejects(
      collection.insertOne(link(businessA, connectionB, "EB-101", orderA)),
      (error) => error.code === 11000,
      "A Commerce order must not be linked to two seller orders in one business",
    );
    // Same external reference in a separate account, using another canonical
    // order, must not be mistaken for a conflicting marketplace order.
    await collection.insertOne(link(businessA, connectionB, "EB-100", orderB));
    // Existing single-business behaviour is unaffected by foreign business IDs.
    await collection.insertOne(link(businessB, connectionA, "EB-100", orderA));
    assert.equal(await collection.countDocuments({}), 3);
    assert.equal(await collection.countDocuments({ business: businessA }), 2);
    assert.equal(await collection.countDocuments({ business: businessB }), 1);
    assert.equal(await db.db.collection("orders").countDocuments({}), preexistingCommerceOrders);
  } finally {
    await db.dropCollection(collectionName).catch((error) => {
      if (error.codeName !== "NamespaceNotFound") throw error;
    });
    await db.close();
  }
});


test("real MongoDB Commerce ownership preflight excludes unowned and foreign orders", {
  skip: !URI ? "Set SELLER_TXN_ACCEPTANCE_URI to an isolated loopback MongoDB replica set" : false,
  timeout: 45000,
}, async () => {
  const checkedUri = safeAcceptanceUri(URI);
  assert.ok(checkedUri, "Refusing non-acceptance MongoDB URI");
  const db = await mongoose.createConnection(checkedUri, {
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 12000,
  }).asPromise();
  const name = "seller_commerce_owner_accept_" + randomUUID().replaceAll("-", "");
  const collection = db.db.collection(name);
  const businessId = new mongoose.Types.ObjectId();
  const foreignBusiness = new mongoose.Types.ObjectId();
  const connectionId = new mongoose.Types.ObjectId();
  const orders = [
    { _id: new mongoose.Types.ObjectId(), total: 125.4, currency: "GBP" },
    { _id: new mongoose.Types.ObjectId(), business: foreignBusiness,
      total: 125.4, currency: "GBP" },
    { _id: new mongoose.Types.ObjectId(), business: businessId,
      total: 125.4, currency: "GBP" },
  ];
  const sellerConnection = { _id: connectionId, business: businessId,
    status: "connected", provider: "ebay" };
  const source = { business: businessId, connection: connectionId,
    provider: "ebay", externalId: "EB-100", kind: "orders",
    sourceRecord: { amount: "125.40", currency: "GBP",
      placedAt: new Date("2026-10-01T12:00:00Z") } };
  try {
    await db.createCollection(name);
    await collection.insertMany(orders);
    const stagedModel = { findOne: () => ({ select: () => ({
      lean: async () => source,
    }) }) };
    const actualQueries = [];
    const orderModel = { findOne: (query) => {
      actualQueries.push(query);
      return { select: () => ({ lean: async () => collection.findOne(query) }) };
    } };
    for (let i = 0; i < orders.length; i++) {
      const linkModel = { findOne: () => ({ select: () => ({
        lean: async () => ({
          business: businessId, connection: connectionId, provider: "ebay",
          externalOrderId: "EB-100", commerceOrder: orders[i]._id,
          evidenceSource: "operator_proposal",
          verificationStatus: "pending_verification",
        }),
      }) }) };
      const review = await inspectSellerCommerceOrderOwnership(
        sellerConnection, "EB-100", {
          businessId, locationAccessMode: "all",
          stagedModel, linkModel, orderModel,
        });
      assert.equal(review.commerceBusinessOwnershipConfirmed, i === 2);
      assert.equal(review.financialEvidenceMatches, i === 2);
      assert.equal(review.associationApproved, false);
      assert.equal(review.canonicalRecordsWritten, 0);
      assert.equal(review.linksWritten, 0);
      assert.deepEqual(actualQueries.at(-1), {
        _id: orders[i]._id, business: businessId,
      });
    }
    assert.equal(await collection.countDocuments({}), 3);
  } finally {
    await db.dropCollection(name).catch((error) => {
      if (error.codeName !== "NamespaceNotFound") throw error;
    });
    await db.close();
  }
});
