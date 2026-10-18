import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  trustedReportScope,
} from "../features/reports/reportService.js";
import {
  trustedDataExportScope,
} from "../features/dataExportAudit/dataExportAuditService.js";

const businessId = "66f000000000000000000001";
const locationA = "66f000000000000000000011";
const locationB = "66f000000000000000000012";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("report scope is Business-bounded and preserves allowed Location authority", () => {
  const scope = trustedReportScope({
    businessId,
    locationAccessMode: "restricted",
    allowedLocationIds: [locationA, locationB, locationA],
  });

  assert.equal(scope.businessId, businessId);
  assert.deepEqual(scope.locationIds, [locationA, locationB]);
});

test("report scope fails closed without trusted Business authority", () => {
  assert.throws(
    () => trustedReportScope({ allowedLocationIds: [locationA] }),
    (error) =>
      error?.statusCode === 401 &&
      error?.code === "REPORT_TENANT_AUTHORITY_REQUIRED"
  );
});

test("data export scope distinguishes selected, allowed and Business-wide authority", () => {
  const selected = trustedDataExportScope({
    businessId,
    locationId: locationA,
    locationAccessMode: "restricted",
    allowedLocationIds: [locationA, locationB],
  });
  assert.equal(selected.scopeMode, "selected-location");
  assert.equal(selected.selectedLocationId, locationA);

  const allowed = trustedDataExportScope({
    businessId,
    locationAccessMode: "restricted",
    allowedLocationIds: [locationA, locationB],
  });
  assert.equal(allowed.scopeMode, "allowed-locations");
  assert.deepEqual(allowed.locationIds, [locationA, locationB]);

  const all = trustedDataExportScope({
    businessId,
    locationAccessMode: "all",
    allowedLocationIds: [],
  });
  assert.equal(all.scopeMode, "business-wide");
  assert.equal(all.locationIds, null);
});

test("report and export routes attach trusted tenant authority before controllers", async () => {
  const reportRoutes = await source("../features/reports/reportRoutes.js");
  const exportRoutes = await source(
    "../features/dataExportAudit/dataExportAuditRoutes.js"
  );

  for (const routes of [reportRoutes, exportRoutes]) {
    assert.match(routes, /workforcePublicTenantContextMiddleware/);
    assert.match(routes, /trustedTenantContextMiddleware/);
    assert.match(routes, /effectiveAuthorityMiddleware/);
  }
});

test("report and export controllers pass effective authority into services", async () => {
  const reportController = await source(
    "../features/reports/reportController.js"
  );
  const exportController = await source(
    "../features/dataExportAudit/dataExportAuditController.js"
  );

  assert.match(reportController, /req\.effectiveAuthority/);
  assert.match(exportController, /request\.effectiveAuthority/);
});

test("tenant-scoped report services do not trust request Business or Location filters", async () => {
  const reportService = await source(
    "../features/reports/reportService.js"
  );
  const exportService = await source(
    "../features/dataExportAudit/dataExportAuditService.js"
  );

  assert.doesNotMatch(reportService, /filters\.(business|businessId|location|locationId)/);
  assert.doesNotMatch(exportService, /query\.(business|businessId|location|locationId)/);
  assert.match(reportService, /business:\s*scope\.businessId/);
  assert.match(exportService, /business:\s*scope\.businessId/);
});
