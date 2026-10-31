import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import CustomerCommercePolicy from "../features/commerce/CustomerCommercePolicy.js";
import {
  retailOrderStatusReadiness,
} from "../features/aiPlatform/retailCustomerConciergeReadService.js";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("customer commerce policies require Business ownership and support optional Location overrides", () => {
  const business = CustomerCommercePolicy.schema.path("business");
  const location = CustomerCommercePolicy.schema.path("location");
  const type = CustomerCommercePolicy.schema.path("policyType");
  const published = CustomerCommercePolicy.schema.path("published");

  assert.equal(business.isRequired, true);
  assert.equal(location.options.default, undefined);
  assert.deepEqual(type.enumValues, ["delivery", "returns"]);
  assert.equal(published.options.default, false);
});

test("Retail catalogue reads fail closed to trusted Business/Location scope and hide cost fields", async () => {
  const service = await source("../features/aiPlatform/retailCustomerConciergeReadService.js");

  assert.match(service, /filter = \{ business: requireBusinessId\(businessId\) \}/);
  assert.match(service, /if \(cleanLocationId\) filter\.location = cleanLocationId/);
  assert.match(service, /active: true/);
  assert.match(service, /select\("name slug sku brand description category collectionName badge size price stockQuantity images featured"\)/);
  assert.doesNotMatch(service, /select\([^\n]*costPrice/);
});

test("Retail customer policy reads use published effective policy and location-first fallback", async () => {
  const service = await source("../features/aiPlatform/retailCustomerConciergeReadService.js");

  assert.match(service, /published: true/);
  assert.match(service, /effectiveFrom/);
  assert.match(service, /effectiveTo/);
  assert.match(service, /location: scoped\.location/);
  assert.match(service, /RETAIL_CONCIERGE_POLICY_NOT_CONFIGURED/);
});

test("order status stays unavailable until canonical Order tenancy ownership is reconciled", () => {
  const readiness = retailOrderStatusReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "RETAIL_ORDER_SCOPE_NOT_READY");
  assert.match(readiness.reason, /Business\/Location ownership/);
});
