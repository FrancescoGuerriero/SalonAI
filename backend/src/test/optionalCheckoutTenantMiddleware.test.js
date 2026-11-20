import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  createOptionalCheckoutTenantMiddleware,
} from "../features/commerce/optionalCheckoutTenantMiddleware.js";

const userId = "507f1f77bcf86cd799439024";
const businessId = "507f1f77bcf86cd799439021";
const anotherBusiness = "507f1f77bcf86cd799439099";

test("legacy checkout skips membership resolution when no server tenant selection exists", async () => {
  let invoked = 0;
  const middleware = createOptionalCheckoutTenantMiddleware({
    contextResolver: async () => { invoked++; throw new Error("not called"); },
  });
  let passed = false;
  const request = { user: { _id: userId }, body: { businessId: anotherBusiness },
    headers: { "x-business-id": anotherBusiness },
    query: { businessId: anotherBusiness } };
  await middleware(request, {}, (error) => {
    assert.equal(error, undefined); passed = true;
  });
  assert.equal(invoked, 0);
  assert.equal(passed, true);
  assert.equal(request.tenantContext, undefined);
});

test("server-chosen tenant selection uses canonical membership resolver", async () => {
  const seen = [];
  const membershipContext = Object.freeze({ userId, businessId });
  const middleware = createOptionalCheckoutTenantMiddleware({
    contextResolver: async (selection) => {
      seen.push(selection);
      return membershipContext;
    },
  });
  const request = { user: { _id: userId },
    trustedTenantSelection: { businessId, locationId: null },
    body: { businessId: anotherBusiness } };
  let invoked = false;
  await middleware(request, {}, (error) => {
    assert.equal(error, undefined); invoked = true;
  });
  assert.equal(invoked, true);
  assert.deepEqual(seen, [{
    authenticatedUser: request.user,
    requestedBusinessId: businessId,
    requestedLocationId: null,
  }]);
  assert.equal(request.tenantContext, membershipContext);
});

test("a denied membership is returned as an error and never replaced by body authority", async () => {
  const denied = Object.assign(new Error("membership denied"), { statusCode: 403 });
  const middleware = createOptionalCheckoutTenantMiddleware({
    contextResolver: async () => { throw denied; },
  });
  const request = { user: { _id: userId },
    trustedTenantSelection: { businessId },
    body: { businessId: anotherBusiness } };
  let observed = null;
  await middleware(request, {}, (error) => { observed = error; });
  assert.equal(observed, denied);
  assert.equal(request.tenantContext, undefined);
});

test("route resolves selected membership after authentication, before checkout", async () => {
  const routes = await readFile(new URL(
    "../features/commerce/commerceRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.post\("\/checkout", requireFeature\("online-shop"\), protect,\s*optionalCheckoutTenantMiddleware, asyncHandler\(controller\.createCheckout\)\)/);
});
