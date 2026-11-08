import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getAdministrativeModuleCatalogue,
  moduleCatalogueController,
} from "../features/moduleCatalogue/moduleCatalogueController.js";

test("administrative module dashboard returns 27 requirements and 21 candidates without activation rights", () => {
  const snapshot = getAdministrativeModuleCatalogue();
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.statusEvidence, "not independently verified");
  assert.equal(snapshot.entries.length, 48);
  assert.equal(snapshot.categories.length, 15);
  assert.deepEqual(snapshot.integrity, {
    valid: true, requirementCount: 27, candidateCount: 21, categoryCount: 15,
  });
  for (const item of snapshot.entries) {
    assert.equal(item.status.activationAuthorised, false);
    assert.equal(item.status.productionAccepted, null);
    assert.equal(item.status.entitled, null);
    assert.equal(item.productionAcceptance, "unknown");
    assert.equal(item.deploymentStatus, "unknown");
  }
  assert.equal(getAdministrativeModuleCatalogue({ includeCandidates: false }).entries.length, 27);
});

test("catalogue controller exposes a read-only success response", () => {
  let status;
  let response;
  moduleCatalogueController({}, {
    status(value) { status = value; return this; },
    json(value) { response = value; return this; },
  });
  assert.equal(status, 200);
  assert.equal(response.success, true);
  assert.equal(response.catalogue.entries.length, 48);
});

test("catalogue is restricted by existing management RBAC on API and UI", async () => {
  const [routes, app, navigation, dashboard] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/components/navigation/managementNavigationConfig.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/module-catalogue",\s*requirePermissions\("feature-control:read"\)/);
  assert.match(app, /path="admin\/module-catalogue"\s*element=\{permissionPage\(ModuleCatalogueDashboardPage, "feature-control:read"\)\}/);
  assert.match(navigation, /"\/admin\/module-catalogue".*"feature-control:read"/);
  assert.match(dashboard, /API\.get\("\/system-administration\/module-catalogue"\)/);
  assert.doesNotMatch(dashboard, /API\.(post|patch|put|delete)\(/);
  assert.match(dashboard, /Production verification remains unknown/);
});
