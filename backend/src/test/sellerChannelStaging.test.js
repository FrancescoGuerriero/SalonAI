import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stageSellerChannelSnapshot } from "../features/partnerMarketplace/sellerChannelSyncService.js";

const businessId = "507f1f77bcf86cd799439021";
const otherBusinessId = "507f1f77bcf86cd799439022";
const actorId = "507f1f77bcf86cd799439024";
const connection = {
  _id: "507f1f77bcf86cd799439025",
  business: businessId,
  provider: "ebay",
  status: "connected",
};
function harness(records) {
  const writes = [], audits = [], checkpoints = [], leases = [], runs = [];
  const leaseModel = {
    create: async (record) => { leases.push(record); },
    findOneAndUpdate: async (filter) =>
      leases.find((lease) => lease.owner === filter.owner) || null,
    deleteOne: async (filter) => { leases.push({ released: filter }); },
  };
  return {
    writes, audits, checkpoints, leases, leaseModel, runs,
    runModel: {
      findOne: (_filter) => ({
        select: () => ({ sort: () => ({ lean: async () => null }) }),
      }),
      create: async (record) => { runs.push({ ...record }); },
      updateOne: async (filter, update) => {
        const run = runs.find((item) => item.runId === filter.runId);
        if (!run) throw new Error("Missing run");
        Object.assign(run, update.$set);
      },
    },
    checkpointModel: { findOne: () => ({ lean: async () => null }), findOneAndUpdate: async (filter, update, options) => {
      checkpoints.push({ filter, update, options });
    } },
    readSnapshot: async () => ({ provider: "ebay", kind: "listings", records }),
    recordsModel: { bulkWrite: async (operations) => { writes.push(...operations); } },
    auditModel: { create: async (record) => { audits.push(record); } },
  };
}
test("manual seller sync stages tenant-owned records with idempotent keys and audit metadata", async () => {
  const h = harness([{ provider: "ebay", sku: "SKU-1", status: null, quantity: 2 }]);
  const result = await stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, requestId: "request-1", ...h,
  });
  assert.equal(result.stagedCount, 1);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.state, "staging_only");
  assert.equal(result.sourcePageComplete, false);
  assert.equal(h.writes.length, 1);
  assert.equal(h.runs[0].state, "completed");
  assert.equal(h.runs[0].stagedCount, 1);
  assert.equal(h.leases.length, 2);
  assert.equal(h.leases[0].business, businessId);
  assert.equal(h.leases[1].released.owner, h.leases[0].owner);
  assert.equal(h.checkpoints.length, 1);
  assert.equal(h.checkpoints[0].filter.business, businessId);
  assert.equal(h.checkpoints[0].update.$set.sourcePageComplete, false);
  assert.equal(h.checkpoints[0].update.$set.resumeSupported, false);
  const op = h.writes[0].updateOne;
  assert.deepEqual(op.filter, {
    business: businessId, connection: connection._id, kind: "listings", externalId: "SKU-1",
  });
  assert.equal(op.upsert, true);
  assert.equal(op.update.$set.sourceRecord.quantity, 2);
  assert.equal(h.audits[0].action, "seller_channel.snapshot_staged");
  assert.equal(h.audits[0].metadata.businessId, businessId);
  assert.equal(h.audits[0].metadata.sourcePageComplete, false);
  assert.ok(!JSON.stringify(h.audits).includes("SKU-1"));
});

test("manual seller sync refuses foreign tenant, suspended connection, duplicate ids, bad quantities", async () => {
  const h = harness([{ provider: "ebay", sku: "SKU-1", quantity: 2 }]);
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    ...h, businessId: otherBusinessId, actorId,
  }));
  await assert.rejects(stageSellerChannelSnapshot({ ...connection, status: "degraded" }, "listings", {
    ...h, businessId, actorId,
  }));
  const duplicate = harness([
    { sku: "DUP", quantity: 1 }, { sku: "DUP", quantity: 2 },
  ]);
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    ...duplicate, businessId, actorId,
  }));
  const invalid = harness([{ sku: "SKU-1", quantity: -4 }]);
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    ...invalid, businessId, actorId,
  }));
  assert.equal(h.writes.length + duplicate.writes.length + invalid.writes.length, 0);
});

test("seller staging does not accept unbounded provider records or unsupported mutations", async () => {
  const tooMany = harness(Array.from({ length: 51 }, (_, index) => ({
    sku: `SKU-${index}`, quantity: 1,
  })));
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    ...tooMany, businessId, actorId,
  }));
  await assert.rejects(stageSellerChannelSnapshot(connection, "refunds", {
    ...tooMany, businessId, actorId,
  }));
  assert.equal(tooMany.writes.length, 0);
});

test("seller staging model and route prevent writes to canonical Commerce or Invoice", async () => {
  const [routes, service, model] = await Promise.all([
    readFile(new URL("../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../features/partnerMarketplace/sellerChannelSyncService.js", import.meta.url), "utf8"),
    readFile(new URL("../models/SellerChannelStagingRecord.js", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/\:connectionId\/stage\/\:kind"/);
  assert.match(routes, /"feature-control:update"/);
  assert.match(routes, /ownedConnection\(request\)/);
  assert.match(model, /schema.index\(\{ business: 1, connection: 1, kind: 1, externalId: 1 \}, \{ unique: true \}\)/);
  assert.match(service, /recordsModel\.bulkWrite/);
  assert.doesNotMatch(service, /Product\.|CommerceOrder\.|StockAdjustment\.|Payment\./);
});

test("staging signals a completely read provider page without claiming canonical synchronization", async () => {
  const h = harness([]);
  const result = await stageSellerChannelSnapshot(connection, "listings", {
    ...h, businessId, actorId,
    readSnapshot: async () => ({
      provider: "ebay", kind: "listings", records: [{ sku: "EX-1", quantity: 1 }],
      pagesFetched: 2, completeWithinLimit: true,
    }),
  });
  assert.equal(result.stagedCount, 1);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.sourcePageComplete, true);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(h.audits[0].metadata.sourcePageComplete, true);
  assert.equal(h.checkpoints[0].update.$set.sourcePageComplete, true);
});

test("encrypted seller continuation is scoped to the connection and never appears in response or audit", async () => {
  const previous = process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;
  process.env.INTEGRATION_SECRET_ENCRYPTION_KEY = "test-only-seller-checkpoint-secret";
  try {
    const first = harness([{ sku: "SKU-A", quantity: 3 }]);
    first.readSnapshot = async (_connection, _kind, options) => {
      assert.equal(options.resumeCursor, null);
      assert.equal(options.includeResumeCursor, true);
      return {
        provider: "ebay", kind: "listings", records: [{ sku: "SKU-A", quantity: 3 }],
        nextPageAvailable: true, internalResumeCursor: "28",
        pagesFetched: 5, completeWithinLimit: false,
      };
    };
    const staged = await stageSellerChannelSnapshot(connection, "listings", {
      businessId, actorId, ...first,
    });
    assert.equal(staged.resumeAvailable, true);
    assert.equal(first.checkpoints[0].update.$set.resumeSupported, true);
    assert.notEqual(first.checkpoints[0].update.$set.cursorCiphertext, "28");
    assert.ok(!JSON.stringify(staged).includes("28"));
    assert.ok(!JSON.stringify(first.audits).includes("28"));

    const checkpoint = first.checkpoints[0].update.$set;
    const second = harness([]);
    second.checkpointModel.findOne = (filter) => ({
      lean: async () => {
        assert.equal(filter.business, businessId);
        assert.equal(filter.connection, connection._id);
        assert.equal(filter.provider, "ebay");
        return checkpoint;
      },
    });
    second.readSnapshot = async (_connection, _kind, options) => {
      assert.equal(options.resumeCursor, "28");
      return { provider: "ebay", kind: "listings", records: [],
        completeWithinLimit: true, nextPageAvailable: false, pagesFetched: 1 };
    };
    const resumed = await stageSellerChannelSnapshot(connection, "listings", {
      businessId, actorId, resume: true, ...second,
    });
    assert.equal(resumed.resumeAvailable, false);
    assert.equal(second.checkpoints[0].update.$set.cursorCiphertext, "");
    assert.equal(second.checkpoints[0].update.$set.resumeSupported, false);
    assert.equal(resumed.canonicalRecordsWritten, 0);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;
    else process.env.INTEGRATION_SECRET_ENCRYPTION_KEY = previous;
  }
});

test("resume refuses absent checkpoint before contacting provider", async () => {
  const f = harness([]);
  let fetchCount = 0;
  await assert.rejects(stageSellerChannelSnapshot(connection, "orders", {
    businessId, actorId, resume: true, ...f,
    readSnapshot: async () => { fetchCount++; throw new Error("Provider should not be called"); },
  }), /No resumable seller checkpoint/);
  assert.equal(fetchCount, 0);
  assert.equal(f.writes.length, 0);
});

test("seller staging lease rejects a competing import before provider read", async () => {
  const f = harness([]);
  let fetched = 0;
  f.leaseModel.create = async () => {
    const conflict = new Error("duplicate key");
    conflict.code = 11000;
    throw conflict;
  };
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...f,
    readSnapshot: async () => { fetched++; throw new Error("Unexpected provider read"); },
  }), /already running/);
  assert.equal(fetched, 0);
  assert.equal(f.writes.length, 0);
});

test("seller import lease releases its own lock when provider read fails", async () => {
  const f = harness([]);
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...f,
    readSnapshot: async () => { throw new Error("Provider unavailable"); },
  }), /Provider unavailable/);
  assert.equal(f.leases.length, 2);
  assert.equal(f.leases[1].released.owner, f.leases[0].owner);
  assert.equal(f.checkpoints.length, 0);
  assert.equal(f.audits.length, 0);
});

test("staging fails closed after import lease ownership expires before provider results are written", async () => {
  const f = harness([{ sku: "SKU-EXP", quantity: 3 }]);
  f.leaseModel.findOneAndUpdate = async () => null;
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...f,
  }), /ownership expired/);
  assert.equal(f.writes.length, 0);
  assert.equal(f.checkpoints.length, 0);
  assert.equal(f.audits.length, 0);
  assert.equal(f.leases.length, 2);
});

test("failed checkpoint is journalled and source staging is not misreported as complete", async () => {
  const h = harness([{ sku: "SKU-RECOVERY", quantity: 1 }]);
  h.checkpointModel.findOneAndUpdate = async () => {
    throw new Error("Checkpoint database temporarily unavailable");
  };
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...h,
  }), /Checkpoint database temporarily unavailable/);
  assert.equal(h.writes.length, 1);
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0].state, "failed");
  assert.equal(h.runs[0].failureClass, "checkpoint");
  assert.equal(h.runs[0].stagedCount, 1);
  assert.equal(h.audits.length, 0);
  assert.equal(h.leases.length, 2);
  assert.equal(h.runs[0].connection, connection._id);
  assert.ok(!JSON.stringify(h.runs).includes("SKU-RECOVERY"));
});

test("provider failure is journalled without staging or a false checkpoint", async () => {
  const h = harness([]);
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...h,
    readSnapshot: async () => { throw new Error("No seller credentials"); },
  }), /No seller credentials/);
  assert.equal(h.runs[0].state, "failed");
  assert.equal(h.runs[0].failureClass, "provider_or_validation");
  assert.equal(h.writes.length, 0);
  assert.equal(h.checkpoints.length, 0);
});

test("incomplete seller import requires an explicit recovery acknowledgement before provider reads", async () => {
  const h = harness([{ sku: "SKU-RETRY", quantity: 2 }]);
  let providerReads = 0;
  const old = h.readSnapshot;
  h.readSnapshot = async (...args) => {
    providerReads++;
    return old(...args);
  };
  h.runModel.findOne = (filter) => ({
    select: () => ({ sort: () => ({ lean: async () => {
      assert.equal(filter.business, businessId);
      assert.equal(filter.connection, connection._id);
      assert.equal(filter.kind, "listings");
      return { state: "failed", failureClass: "checkpoint", stagedCount: 1 };
    } }) }),
  });
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, ...h,
  }), /Previous seller import is incomplete/);
  assert.equal(providerReads, 0);
  assert.equal(h.runs.length, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(h.checkpoints.length, 0);
  const result = await stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, recoveryAcknowledged: true, ...h,
  });
  assert.equal(result.recoveryReviewAcknowledged, true);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(providerReads, 1);
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0].state, "completed");
});

test("recovery acknowledgement must be strictly boolean true", async () => {
  const h = harness([]);
  h.runModel.findOne = () => ({
    select: () => ({ sort: () => ({ lean: async () => ({ state: "staged" }) }) }),
  });
  await assert.rejects(stageSellerChannelSnapshot(connection, "listings", {
    businessId, actorId, recoveryAcknowledged: "true", ...h,
  }), /Previous seller import is incomplete/);
  assert.equal(h.writes.length, 0);
});
