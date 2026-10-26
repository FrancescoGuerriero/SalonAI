import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Point 10 management BI reuses canonical metric authority", async () => {
  const service = await source("../features/analytics/managementBiService.js");
  assert.match(service, /appointmentMetricCalculator/);
  assert.match(service, /APPOINTMENT_METRIC_KEYS/);
  assert.match(service, /listMetricDefinitions/);
  assert.match(service, /salonai\.management-bi\.v1/);
  assert.match(service, /governed_management_evidence_v1/);
  assert.match(service, /pythonMayRecalculateCanonicalMetrics:\s*false/);
});

test("Point 10 excludes ambiguous legacy location facts and scopes by effective authority", async () => {
  const service = await source("../features/analytics/managementBiService.js");
  assert.match(service, /effectiveAuthority\.businessId/);
  assert.match(service, /effectiveAuthority\.locationAccessMode === "all"/);
  assert.match(service, /effectiveAuthority\.allowedLocationIds/);
  assert.match(service, /Location\.find\(\{/);
  assert.match(service, /location:\s*\{ \$in: scope\.locationIds \}/);
  assert.match(service, /ambiguousLegacyLocationExcluded:\s*true/);
  assert.match(service, /containsCustomerPii:\s*false/);
});

test("Point 10 management route requires trusted tenant and effective aggregate authority", async () => {
  const routes = await source("../features/premium/analytics/premiumAnalyticsRoutes.js");
  assert.match(routes, /\/management/);
  assert.match(routes, /workforcePublicTenantContextMiddleware/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /requireEffectivePermissions\("premium-analytics:read"\)/);
});

test("Point 10 Python analysis consumes canonical evidence only and cannot execute actions", async () => {
  const schema = await source("../../../ai-service/app/schemas/management_bi.py");
  const service = await source("../../../ai-service/app/services/management_bi.py");
  const gateway = await source("../../../ai-service/app/api/routes/ai_gateway.py");
  const registry = await source("../../../ai-service/app/governance/ai_registry.py");

  assert.match(schema, /governed_management_evidence_v1/);
  assert.match(schema, /business_id/);
  assert.match(schema, /location_id/);
  assert.match(schema, /evidence_id/);
  assert.match(schema, /checksum/);
  assert.match(service, /Deterministic statistical analysis/);
  assert.doesNotMatch(service, /pymongo|MongoClient|mongoose|Appointment|Customer/);
  assert.match(gateway, /\/management-analysis/);
  assert.match(gateway, /Depends\(require_service_key\)/);
  assert.match(registry, /management-copilot/);
  assert.match(registry, /governed_management_evidence_v1/);
  assert.match(registry, /modelInferenceRequired": False/);
  assert.match(registry, /forecastExecutionAuthorised": False/);
});

test("Point 10 Premium Analytics is a provenance-aware Node-backed BI workspace", async () => {
  const page = await source("../../../frontend/src/pages/PremiumAnalyticsPage.jsx");
  assert.match(page, /\/premium-analytics\/management/);
  assert.match(page, /Metric provenance/);
  assert.match(page, /Authority scope/);
  assert.match(page, /Python analysis boundary/);
  assert.match(page, /Customer PII included: no/);
  assert.doesNotMatch(page, /AI_SERVICE_BASE_URL|8000|\/api\/v1\/ai-gateway/);
});
