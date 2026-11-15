import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { inspectSellerChannelOrderStates } from "../features/partnerMarketplace/sellerChannelOrderStateInspection.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const connection = { _id: connectionId, business: businessId, status: "connected", provider: "ebay" };
const row = (externalId, fields = {}) => ({
  business: businessId, connection: connectionId, kind: "orders", provider: "ebay",
  externalId, sourceRecord: { status: "FULFILLED", fulfillmentStatus: "FULFILLED", ...fields },
  lastObservedAt: new Date("2026-11-15T10:00:00Z"),
});
function fixture(rows = []) {
  const filters = [];
  return {
    filters,
    stagedModel: { find(filter) {
      filters.push(filter);
      return { sort: () => ({ limit: () => ({ lean: async () => rows }) }) };
    } },
  };
}
const options = { businessId, locationAccessMode: "all", limit: 10 };

test("tenant-wide seller order observations stay read-only and do not infer returns", async () => {
  const deps = fixture([row("EB-001"), row("EB-002", { status: "", fulfillmentStatus: "" }),
    row("EB-003", { status: "NOT_STARTED", fulfillmentStatus: "FULFILLED" })]);
  const result = await inspectSellerChannelOrderStates(connection, { ...options, ...deps });
  assert.deepEqual(result.records.map((r) => r.reviewState), [
    "observation_only", "insufficient_provider_state", "provider_state_disagreement",
  ]);
  assert.equal(result.records[1].observedOrderState, null);
  assert.equal(result.records[2].observedFulfillmentState, "FULFILLED");
  assert.ok(result.records.every((r) => r.returnsStatus === "not_implemented"));
  assert.equal(result.canonicalOrdersCompared, false);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.refundsIssued, 0);
  assert.equal(result.fulfillmentWrites, 0);
  assert.equal(result.productionAccepted, false);
  assert.equal(Object.isFrozen(result.records), true);
  assert.ok(result.records.every((r) => Object.isFrozen(r)));
  assert.deepEqual(deps.filters[0], {
    business: businessId, connection: connectionId, provider: "ebay", kind: "orders",
  });
});

test("location-restricted, unauthorised and invalid tenant requests cannot query staging", async () => {
  for (const overrides of [
    { locationAccessMode: "selected" }, { locationAccessMode: undefined },
    { businessId: "507f1f77bcf86cd799439099" },
    { limit: 0 }, { limit: 51 }, { limit: "abc" },
  ]) {
    const deps = fixture();
    await assert.rejects(inspectSellerChannelOrderStates(connection, {
      ...options, ...overrides, ...deps,
    }));
    assert.equal(deps.filters.length, 0);
  }
  const deps = fixture();
  await assert.rejects(inspectSellerChannelOrderStates({ ...connection, status: "disconnected" },
    { ...options, ...deps }));
  assert.equal(deps.filters.length, 0);
});

test("cross-tenant, duplicate, missing and wrong-kind observations fail closed", async () => {
  for (const rows of [
    [row("EB-X", {}), row("EB-X")],
    [row("")],
    [{ ...row("EB-X"), business: "507f1f77bcf86cd799439099" }],
    [{ ...row("EB-X"), kind: "listings" }],
    null,
  ]) {
    await assert.rejects(inspectSellerChannelOrderStates(connection, {
      ...options, ...fixture(rows),
    }));
  }
});

test("order-state route applies trusted tenant, order-read and no write paths", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/order-states", requirePermissions\("order:read"\)/);
  assert.match(routes, /locationAccessMode: request\.effectiveAuthority\.locationAccessMode/);
  assert.match(routes, /businessId: request\.effectiveAuthority\.businessId/);
  assert.match(routes, /inspectSellerChannelOrderStates\(await ownedConnection\(request\)/);
});
