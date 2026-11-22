import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { listSellerChannelConnections } from "../features/partnerMarketplace/sellerChannelConnectionList.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const rows = [{
  _id: connectionId, business: businessId, provider: "ebay",
  connectionKey: "seller-uk", status: "connected",
  credentialBindings: [{ secret: "should-not-return" }],
  metadata: { refreshToken: "should-not-return" },
  connectedAt: new Date("2026-11-01T12:00:00Z"),
}];
function fixture(result = rows) {
  const queries = [];
  return { queries, connectionModel: { find: (filter) => {
    queries.push(filter);
    return { select: (fields) => {
      queries.push(fields);
      return { sort: () => ({ limit: () => ({ lean: async () => result }) }) };
    } };
  } } };
}

test("seller connection discovery is tenant scoped, credential-free and capped", async () => {
  const f = fixture();
  const report = await listSellerChannelConnections({
    businessId, locationAccessMode: "all", connectionModel: f.connectionModel,
  });
  assert.deepEqual(report.connections, [{
    id: connectionId, provider: "ebay", connectionKey: "seller-uk",
    status: "connected", connectedAt: "2026-11-01T12:00:00.000Z",
    lastSyncAt: null,
  }]);
  assert.equal(report.credentialsIncluded, false);
  assert.ok(!JSON.stringify(report).includes("should-not-return"));
  assert.ok(!f.queries[1].includes("credentialBindings"));
  assert.equal(f.queries[0].business, businessId);
  assert.deepEqual(f.queries[0].provider.$in, ["amazon_seller_central", "ebay"]);
});

test("foreign, disconnected or malformed seller records fail closed", async () => {
  for (const invalid of [
    [{ ...rows[0], business: "507f1f77bcf86cd799439099" }],
    [{ ...rows[0], provider: "stripe" }],
    [{ ...rows[0], status: "revoked" }],
    Array.from({ length: 51 }, () => rows[0]),
    null,
  ]) {
    const f = fixture(invalid);
    await assert.rejects(listSellerChannelConnections({
      businessId, locationAccessMode: "all", connectionModel: f.connectionModel,
    }));
  }
  const f = fixture();
  await assert.rejects(listSellerChannelConnections({
    businessId, locationAccessMode: "selected", connectionModel: f.connectionModel,
  }));
  assert.equal(f.queries.length, 0);
});

test("seller connection discovery is mounted under protected feature read scope", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/connections", requirePermissions\("feature-control:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /listSellerChannelConnections\(/);
});
