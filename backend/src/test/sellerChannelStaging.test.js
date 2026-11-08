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
  const writes = [], audits = [];
  return {
    writes, audits,
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
});
