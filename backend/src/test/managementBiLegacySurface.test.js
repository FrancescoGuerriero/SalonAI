import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getPremiumAnalytics, getManagementBi } from
  "../features/premium/analytics/premiumAnalyticsController.js";

test("Module 16 legacy root analytics returns explicit retirement instead of unscoped business data", async () => {
  await assert.rejects(
    getPremiumAnalytics(),
    (error) => error.statusCode === 410 &&
      error.details?.code === "PREMIUM_ANALYTICS_LEGACY_UNSCOPED_DISABLED",
  );
});

test("Module 16 legacy controller cannot call unscoped cross-tenant operational collections", async () => {
  const [controller, routes, page] = await Promise.all([
    readFile(new URL("../features/premium/analytics/premiumAnalyticsController.js",
      import.meta.url), "utf8"),
    readFile(new URL("../features/premium/analytics/premiumAnalyticsRoutes.js",
      import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/PremiumAnalyticsPage.jsx",
      import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(controller, /\.countDocuments\(|\.aggregate\(|\.find\(/);
  assert.doesNotMatch(controller, /legacyUnscopedCompatibilitySurface:\s*true/);
  assert.match(controller, /PREMIUM_ANALYTICS_LEGACY_UNSCOPED_DISABLED/);
  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /requirePermissions\("premium-analytics:read"\)/);
  assert.match(routes, /getPremiumAnalytics/);
  assert.match(routes, /workforcePublicTenantContextMiddleware/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /requireEffectivePermissions\("premium-analytics:read"\)/);
  assert.match(page, /\/premium-analytics\/management/);
  assert.ok(typeof getManagementBi === "function");
});
