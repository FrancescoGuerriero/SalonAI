import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { inspectSellerConnectionReadiness } from "../features/partnerMarketplace/sellerChannelReadiness.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const connection = {
  business: businessId, _id: connectionId,
  provider: "ebay", status: "connected",
};
const result = (kind, data = {}) => ({
  source: "read_only_provider_snapshot", kind, provider: "ebay",
  records: [], recordCount: 0, pagesFetched: 1,
  nextPageAvailable: false, completeWithinLimit: true,
  canonicalRecordsWritten: 0, ordersFulfilled: 0,
  returnsProcessed: 0, publicationEnabled: false,
  ...data,
});

test("merchant diagnostic reads at most one listing/order and never approves writes", async () => {
  const calls = [];
  const report = await inspectSellerConnectionReadiness(connection, {
    businessId, locationAccessMode: "all",
    fetchSnapshot: async (_connection, kind, options) => {
      calls.push([kind, options.limit]);
      return result(kind);
    },
  });
  assert.deepEqual(calls, [["listings", 1], ["orders", 1]]);
  assert.equal(report.allReadChecksPassed, true);
  assert.equal(report.productionAccepted, false);
  assert.equal(report.writeOperationsEnabled, false);
  assert.equal(report.canonicalRecordsWritten, 0);
  assert.ok(report.unacceptedWriteCapabilities.includes("inventory_writeback"));
  assert.ok(report.unacceptedWriteCapabilities.includes("listing_publication"));
  assert.ok(Object.isFrozen(report.checks));
});

test("denied tenant, malformed connection and location scope perform no network calls", async () => {
  for (const [conn, scope] of [
    [connection, { businessId: "507f1f77bcf86cd799439099", locationAccessMode: "all" }],
    [connection, { businessId, locationAccessMode: "selected" }],
    [{ ...connection, status: "revoked" }, { businessId, locationAccessMode: "all" }],
    [{ ...connection, provider: "unknown" }, { businessId, locationAccessMode: "all" }],
  ]) {
    let calls = 0;
    await assert.rejects(inspectSellerConnectionReadiness(conn, {
      ...scope, fetchSnapshot: async () => { calls++; return result("orders"); },
    }));
    assert.equal(calls, 0);
  }
});

test("provider credentials, private buyer data and provider errors are never forwarded", async () => {
  const report = await inspectSellerConnectionReadiness(connection, {
    businessId, locationAccessMode: "all",
    fetchSnapshot: async (_connection, kind) => {
      if (kind === "listings") {
        throw Object.assign(new Error("secret-access-token"), {
          details: { code: "SELLER_CHANNEL_PROVIDER_ERROR" },
        });
      }
      return result("orders", { records: [{
        buyerEmail: "buyer@example.invalid", token: "secret-access-token",
      }], recordCount: 1 });
    },
  });
  assert.equal(report.allReadChecksPassed, false);
  assert.equal(report.checks[0].status, "read_access_unconfirmed");
  assert.equal(report.checks[0].errorCode, "SELLER_CHANNEL_PROVIDER_ERROR");
  assert.equal(report.checks[1].status, "read_access_confirmed");
  assert.ok(!JSON.stringify(report).includes("buyer@example.invalid"));
  assert.ok(!JSON.stringify(report).includes("secret-access-token"));
});

test("malformed API results never claim a confirmed read", async () => {
  for (const bad of [
    { ...result("listings"), canonicalRecordsWritten: 1 },
    { ...result("listings"), publicationEnabled: true },
    { ...result("listings"), records: [], recordCount: 1 },
    { ...result("listings"), nextPageAvailable: true, ordersFulfilled: 1 },
    { ...result("listings"), provider: "amazon_seller_central" },
    { ...result("listings"), pagesFetched: 0 },
    { ...result("listings"), pagesFetched: 6 },
    { ...result("listings"), completeWithinLimit: false },
    { ...result("listings"), nextPageAvailable: "false" },
  ]) {
    const report = await inspectSellerConnectionReadiness(connection, {
      businessId, locationAccessMode: "all",
      fetchSnapshot: async (_conn, kind) => kind === "listings" ? bad : result(kind),
    });
    assert.equal(report.allReadChecksPassed, false);
    assert.equal(report.checks[0].status, "read_access_unconfirmed");
  }
});

test("diagnostics never expose arbitrary provider or SDK error-code contents", async () => {
  const privateValues = [
    "secret-access-token",
    "https://attacker.example.invalid/credential?token=private",
    "SELLER_CHANNEL_SECRET_ACCESS_TOKEN",
    "seller account email: private@example.invalid",
  ];
  for (const leaked of privateValues) {
    const report = await inspectSellerConnectionReadiness(connection, {
      businessId, locationAccessMode: "all",
      fetchSnapshot: async (_conn, kind) => {
        if (kind === "listings") {
          throw Object.assign(new Error("Provider failure"), {
            details: { code: leaked },
          });
        }
        return result(kind);
      },
    });
    assert.equal(report.allReadChecksPassed, false);
    assert.equal(report.checks[0].status, "read_access_unconfirmed");
    assert.equal(report.checks[0].errorCode, "SELLER_DIAGNOSTIC_CHECK_FAILED");
    assert.ok(!JSON.stringify(report).includes(leaked));
  }
});

test("diagnostic route requires tenant-wide feature permission and never caches results", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.post\("\/:connectionId\/diagnose", requirePermissions\("feature-control:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /inspectSellerConnectionReadiness\(await ownedConnection\(request\)/);
  assert.match(routes, /"private, no-store"/);
});
