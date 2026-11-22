import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveCheckoutOrderBusiness } from "../features/commerce/checkoutOrderOwnership.js";

const userId = "507f1f77bcf86cd799439024";
const businessId = "507f1f77bcf86cd799439021";
const otherUserId = "507f1f77bcf86cd799439099";

test("checkout order ownership requires authenticated server-resolved business context", () => {
  assert.equal(resolveCheckoutOrderBusiness({ _id: userId }, {
    userId, businessId,
  }), businessId);
  assert.equal(resolveCheckoutOrderBusiness({ _id: userId }, null), undefined);
  assert.equal(resolveCheckoutOrderBusiness({ _id: userId }), undefined);
});

test("untrusted or inconsistent checkout authority cannot assign Commerce ownership", () => {
  for (const context of [
    { businessId, userId: otherUserId },
    { businessId, userId: "" },
    { businessId: "not-an-id", userId },
    { businessId: undefined, userId },
    {},
    { businessId, userId: null },
  ]) {
    assert.throws(() => resolveCheckoutOrderBusiness({ _id: userId }, context),
      (error) => error.details?.code === "COMMERCE_CHECKOUT_TENANT_AUTHORITY_INVALID");
  }
  assert.throws(() => resolveCheckoutOrderBusiness(null, { businessId, userId }),
    (error) => error.details?.code === "COMMERCE_CHECKOUT_TENANT_AUTHORITY_INVALID");
});

test("checkout wiring does not accept request body or user profile as business authority", async () => {
  const service = await readFile(new URL(
    "../features/commerce/commerceService.js", import.meta.url), "utf8");
  const controller = await readFile(new URL(
    "../features/commerce/commerceController.js", import.meta.url), "utf8");
  assert.match(service, /export async function createCheckout\(payload, user, \{ tenantContext = null \} = \{\}\)/);
  assert.match(service, /const orderBusinessId = resolveCheckoutOrderBusiness\(user, tenantContext\);/);
  assert.match(service, /order = await Order\.create\(\{\s*business: orderBusinessId,/);
  assert.match(controller, /tenantContext: req\.tenantContext \?\? null/);
  assert.doesNotMatch(controller, /tenantContext: req\.body/);
});
