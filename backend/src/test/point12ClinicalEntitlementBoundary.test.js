import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Clinical Records requires tenant authority and commercial entitlement before regulated eligibility or RBAC", async () => {
  const routes = await source("../features/clinical/clinicalRoutes.js");

  const trustedIndex = routes.indexOf("router.use(trustedTenantContextMiddleware)");
  const authorityIndex = routes.indexOf("router.use(effectiveAuthorityMiddleware)");
  const entitlementIndex = routes.indexOf('router.use(requireCommercialModule("clinical-records"))');
  const eligibilityRouteIndex = routes.indexOf('"/eligibility"');
  const eligibilityMiddlewareIndex = routes.indexOf("requireClinicalEligibility");

  assert.ok(trustedIndex >= 0);
  assert.ok(authorityIndex > trustedIndex);
  assert.ok(entitlementIndex > authorityIndex);
  assert.ok(eligibilityRouteIndex > entitlementIndex);
  assert.ok(eligibilityMiddlewareIndex >= 0);

  assert.match(routes, /"clinical:eligibility:manage"/);
  assert.match(routes, /"clinical:record:read"/);
  assert.match(routes, /"clinical:record:write"/);
  assert.match(routes, /"clinical:record:sign"/);
  assert.match(routes, /"clinical:consent:manage"/);
  assert.match(routes, /"clinical:credential:manage"/);
  assert.match(routes, /"clinical:media:manage"/);
});

test("Clinical Records entitlement remains distinct from regional and Location eligibility", async () => {
  const routes = await source("../features/clinical/clinicalRoutes.js");
  const eligibility = await source("../features/clinical/clinicalEligibilityMiddleware.js");

  assert.match(routes, /requireCommercialModule\("clinical-records"\)/);
  assert.match(routes, /requireClinicalEligibility/);
  assert.match(routes, /requireClinicalProfileLocation/);
  assert.match(eligibility, /CLINICAL_PACK_NOT_ELIGIBLE/);
  assert.match(eligibility, /CLINICAL_REGION_REQUIRED/);
  assert.match(eligibility, /CLINICAL_PROFILE_LOCATION_RESTRICTED/);
});
