import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { requireSellerTenantWideLocation } from "../features/partnerMarketplace/sellerChannelLocationGuard.js";

function check(authority) {
  let nextCalls = 0;
  let received;
  requireSellerTenantWideLocation({ effectiveAuthority: authority }, {}, (error) => {
    nextCalls++;
    received = error;
  });
  assert.equal(nextCalls, 1);
  return received;
}

test("seller account-wide reads and writes deny location-scoped or missing authority", () => {
  for (const authority of [
    undefined, null, {}, { locationAccessMode: "selected" },
    { locationAccessMode: "none" }, { locationAccessMode: "ALL" },
  ]) {
    const error = check(authority);
    assert.equal(error?.statusCode, 403);
    assert.equal(error?.details?.code, "SELLER_CHANNEL_TENANT_WIDE_LOCATION_REQUIRED");
  }
  assert.equal(check({ locationAccessMode: "all" }), undefined);
});

test("seller snapshots, fulfilment reads and staging all enforce tenant-wide guard before source access", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/import-status", requirePermissions\("feature-control:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /router\.get\("\/:connectionId\/fulfillments\/:orderId", requirePermissions\("order:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /router\.post\("\/:connectionId\/stage\/:kind", requirePermissions\("feature-control:update"\),\s*requireSellerTenantWideLocation/);
  const generic = routes.slice(routes.indexOf('router.get("/:connectionId/:kind"'));
  assert.match(generic, /requireSellerTenantWideLocation, asyncHandler/);
  assert.match(routes, /trustedTenantContextMiddleware, effectiveAuthorityMiddleware/);
});
