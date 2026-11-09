import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { inspectSellerChannelImportStatus } from "../features/partnerMarketplace/sellerChannelImportStatusService.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const connection = {
  _id: connectionId, business: businessId, provider: "ebay", status: "connected",
};
const now = new Date("2026-11-09T15:00:00Z");

function models({ leases = [], checkpoints = [] } = {}) {
  const queried = [];
  return {
    queried,
    leaseModel: {
      find(filter) {
        queried.push({ type: "lease", filter });
        return { select: () => ({ lean: async () => leases }) };
      },
    },
    checkpointModel: {
      find(filter) {
        queried.push({ type: "checkpoint", filter });
        return { select: () => ({ lean: async () => checkpoints }) };
      },
    },
  };
}
test("operational status shows busy and resumable separately without exposing secret tokens", async () => {
  const m = models({
    leases: [{ kind: "listings", expiresAt: new Date("2026-11-09T15:03:00Z"),
      owner: "private-owner-uuid" }],
    checkpoints: [{ kind: "listings", stagedCount: 8, pagesFetched: 3,
      resumeSupported: true, lastObservedAt: new Date("2026-11-09T14:57:00Z"),
      sourcePageComplete: false, cursorCiphertext: "secret-encrypted-token" }],
  });
  const result = await inspectSellerChannelImportStatus(connection, {
    businessId, now, ...m,
  });
  assert.equal(result.kinds[0].kind, "listings");
  assert.equal(result.kinds[0].lockState, "active");
  assert.equal(result.kinds[0].resumeAvailable, true);
  assert.equal(result.kinds[0].stagedCount, 8);
  assert.equal(result.kinds[1].lockState, "idle");
  assert.equal(result.kinds[1].resumeAvailable, false);
  assert.equal(result.kinds[0].historicalSyncComplete, false);
  assert.equal(result.kinds[0].canonicalRecordsWritten, 0);
  assert.ok(!JSON.stringify(result).includes("private-owner-uuid"));
  assert.ok(!JSON.stringify(result).includes("secret-encrypted-token"));
  assert.equal(m.queried[0].filter.business, businessId);
  assert.equal(m.queried[0].filter.connection, connectionId);
  assert.equal(m.queried[1].filter.provider, "ebay");
});

test("stale TTL lease is explicitly shown as expired without being stolen", async () => {
  const m = models({
    leases: [{ kind: "orders", expiresAt: new Date("2026-11-09T14:59:00Z") }],
    checkpoints: [],
  });
  const result = await inspectSellerChannelImportStatus(connection, {
    businessId, now, ...m,
  });
  assert.equal(result.kinds[1].lockState, "expired_pending_cleanup");
  assert.equal(result.kinds[1].resumeAvailable, false);
  assert.equal(result.status, "observations_only");
});

test("foreign business and disconnected seller connections fail before database reads", async () => {
  const m = models();
  for (const input of [
    { ...connection, business: "507f1f77bcf86cd799439022" },
    { ...connection, status: "degraded" },
    { ...connection, provider: "unknown" },
  ]) {
    await assert.rejects(inspectSellerChannelImportStatus(input, {
      businessId, now, ...m,
    }));
  }
  assert.equal(m.queried.length, 0);
});

test("status endpoint requires trusted ownership and read permission; never returns cursors", async () => {
  const [routes, service] = await Promise.all([
    readFile(new URL("../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../features/partnerMarketplace/sellerChannelImportStatusService.js", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/:connectionId\/import-status"/);
  assert.match(routes, /requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /inspectSellerChannelImportStatus\(await ownedConnection\(request\)/);
  assert.doesNotMatch(service, /\.deleteOne\(|\.updateOne\(|\.bulkWrite\(/);
  assert.match(service, /\.select\("kind expiresAt"\)/);
  assert.match(service, /\.select\("kind lastObservedAt stagedCount pagesFetched sourcePageComplete resumeSupported"\)/);
});
