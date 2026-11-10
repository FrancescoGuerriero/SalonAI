import assert from "node:assert/strict";
import test from "node:test";
import { withSellerAtomicSourceCommit } from "../features/partnerMarketplace/sellerChannelAtomicCommit.js";
import { stageSellerChannelSnapshot } from "../features/partnerMarketplace/sellerChannelSyncService.js";

const businessId = "507f1f77bcf86cd799439021";
const actorId = "507f1f77bcf86cd799439024";
const connection = {
  _id: "507f1f77bcf86cd799439025", business: businessId,
  status: "connected", provider: "ebay",
};
function fixture({ checkpointFails = false, uncertainCommit = null } = {}) {
  const persisted = { records: [], checkpoint: [], audits: [], journal: [] };
  const session = {
    pending: [],
    transactions: 0, ended: false, aborted: false,
    async withTransaction(callback) {
      this.transactions++;
      try {
        await callback();
        if (uncertainCommit === "before") {
          const error = new Error("commit reply unknown before applying");
          error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
          throw error;
        }
        for (const apply of this.pending) apply();
        if (uncertainCommit === "after") {
          const error = new Error("commit reply unknown after applying");
          error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
          throw error;
        }
      } catch (error) {
        this.aborted = true;
        throw error;
      } finally {
        this.pending = [];
      }
    },
    async endSession() { this.ended = true; },
  };
  const queue = (sessionArg, apply) => {
    assert.equal(sessionArg, session);
    session.pending.push(apply);
  };
  const state = {
    businessId, actorId, atomicStaging: true,
    startSession: async () => session,
    leaseModel: {
      create: async () => {},
      findOneAndUpdate: async () => ({ owner: "owned" }),
      deleteOne: async () => {},
    },
    runModel: {
      findOne: () => ({ select: () => ({ sort: () => ({ lean: async () => null }) }) }),
      create: async (record) => { persisted.journal.push({ ...record }); },
      updateOne: async (query, update, options = {}) => {
        const apply = () => {
          const current = persisted.journal.find((r) => r.runId === query.runId);
          if (query.state?.$nin?.includes(current.state)) return;
          Object.assign(current, update.$set);
        };
        if (options.session) queue(options.session, apply);
        else apply();
      },
    },
    readSnapshot: async () => ({
      provider: "ebay", kind: "listings", records: [{ sku: "SKU-TXN", quantity: 4 }],
      nextPageAvailable: false, pagesFetched: 1, completeWithinLimit: true,
    }),
    recordsModel: {
      bulkWrite: async (writes, opts) => queue(opts.session, () => persisted.records.push(...writes)),
    },
    checkpointModel: {
      findOneAndUpdate: async (filter, change, opts) => {
        assert.equal(opts.session, session);
        if (checkpointFails) throw new Error("checkpoint failed");
        queue(opts.session, () => persisted.checkpoint.push({ filter, change }));
      },
    },
    auditModel: {
      create: async (docs, opts) => {
        assert.equal(Array.isArray(docs), true);
        queue(opts.session, () => persisted.audits.push(...docs));
      },
    },
  };
  return { persisted, session, state };
}

test("atomic seller batch commits staged records, checkpoint, audit and journal completion together", async () => {
  const f = fixture();
  const result = await stageSellerChannelSnapshot(connection, "listings", f.state);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(f.persisted.records.length, 1);
  assert.equal(f.persisted.checkpoint.length, 1);
  assert.equal(f.persisted.audits.length, 1);
  assert.equal(f.persisted.journal[0].state, "completed");
  assert.equal(f.session.transactions, 1);
  assert.equal(f.session.ended, true);
});

test("atomic seller batch aborts staged writes and cursor on checkpoint error", async () => {
  const f = fixture({ checkpointFails: true });
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", f.state),
    /checkpoint failed/);
  assert.equal(f.session.aborted, true);
  assert.equal(f.session.ended, true);
  assert.equal(f.persisted.records.length, 0);
  assert.equal(f.persisted.checkpoint.length, 0);
  assert.equal(f.persisted.audits.length, 0);
  assert.equal(f.persisted.journal[0].state, "failed");
  assert.equal(f.persisted.journal[0].failureClass, "checkpoint");
});

test("no transactional support fails closed before seller writes", async () => {
  let invoked = false;
  await assert.rejects(withSellerAtomicSourceCommit(async () => { invoked = true; }, {
    startSession: async () => ({ endSession: async () => {} }),
  }), /requires MongoDB transactions/);
  assert.equal(invoked, false);
});

test("ambiguous commit cannot downgrade transactionally completed seller journal", async () => {
  const f = fixture({ uncertainCommit: "after" });
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", f.state),
    /commit reply unknown after applying/);
  assert.equal(f.persisted.records.length, 1);
  assert.equal(f.persisted.checkpoint.length, 1);
  assert.equal(f.persisted.audits.length, 1);
  assert.equal(f.persisted.journal[0].state, "completed");
  assert.equal(f.session.ended, true);
});

test("unresolved seller commit remains fail-closed for operator review", async () => {
  const f = fixture({ uncertainCommit: "before" });
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", f.state),
    /commit reply unknown before applying/);
  assert.equal(f.persisted.records.length, 0);
  assert.equal(f.persisted.checkpoint.length, 0);
  assert.equal(f.persisted.audits.length, 0);
  assert.equal(f.persisted.journal[0].state, "commit_unknown");
  assert.equal(f.persisted.journal[0].failureClass, "unknown");
  assert.equal(f.session.ended, true);
});
