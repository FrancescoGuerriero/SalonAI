import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  inspectBackendRuntimeReleaseIdentity,
} from "../features/moduleCatalogue/moduleCatalogueBackendRuntimeIdentity.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const COMMIT = "a".repeat(40);
const OTHER = "b".repeat(40);
const authority = {
  businessId: BUSINESS,
  locationAccessMode: "all",
  permissions: ["feature-control:read"],
};
const environment = { APP_VERSION: "v8.15.18", RELEASE_SOURCE_COMMIT: COMMIT };
const archive = {
  evidenceValidated: true, deploymentVerified: true,
  releaseTag: "v8.15.18", sourceCommit: COMMIT,
};

test("matching backend release identity is not full runtime verification", async () => {
  const result = await inspectBackendRuntimeReleaseIdentity({
    effectiveAuthority: authority,
  }, {
    environment, archivedInspector: async () => archive,
  });
  assert.equal(result.outcome, "match");
  assert.equal(result.backendIdentityMatched, true);
  assert.equal(result.scope, "backend_process_only");
  assert.equal(result.deploymentVerified, null);
  assert.equal(result.backendHealthVerified, null);
  assert.equal(result.allContainersVerified, null);
  assert.equal(result.runtimeVerified, null);
  assert.equal(result.productionAccepted, null);
  assert.equal(result.activationAuthorised, false);
  assert.equal(Object.hasOwn(result, "host"), false);
});

test("different archive commit or release tag produces explicit mismatch", async () => {
  for (const modified of [
    { ...archive, sourceCommit: OTHER },
    { ...archive, releaseTag: "v8.15.17" },
  ]) {
    const result = await inspectBackendRuntimeReleaseIdentity({
      effectiveAuthority: authority,
    }, {
      environment, archivedInspector: async () => modified,
    });
    assert.equal(result.outcome, "mismatch");
    assert.equal(result.backendIdentityMatched, false);
    assert.equal(result.runtimeVerified, null);
  }
});

test("missing archive, missing identity or malformed evidence does not imply success", async () => {
  const cases = [
    { environment: { APP_VERSION: "dev", RELEASE_SOURCE_COMMIT: COMMIT },
      archivedInspector: async () => archive },
    { environment: { APP_VERSION: "v8.15.18", RELEASE_SOURCE_COMMIT: "local" },
      archivedInspector: async () => archive },
    { environment, archivedInspector: async () => ({ evidenceValidated: null }) },
    { environment, archivedInspector: async () => { throw new Error("secret-host"); } },
  ];
  for (const deps of cases) {
    const result = await inspectBackendRuntimeReleaseIdentity({
      effectiveAuthority: authority,
    }, deps);
    assert.equal(result.backendIdentityMatched, null);
    assert.equal(result.runtimeVerified, null);
    assert.doesNotMatch(JSON.stringify(result), /secret-host/);
  }
});

test("invalid access never reaches the release archive", async () => {
  for (const attrs of [
    { businessId: "invalid" },
    { locationAccessMode: "selected" },
    { permissions: [] },
  ]) {
    let called = false;
    await assert.rejects(inspectBackendRuntimeReleaseIdentity({
      effectiveAuthority: { ...authority, ...attrs },
    }, {
      environment,
      archivedInspector: async () => { called = true; return archive; },
    }));
    assert.equal(called, false);
  }
});

test("backend commit fallback is used only when canonical production commit is absent", async () => {
  const value = await inspectBackendRuntimeReleaseIdentity({
    effectiveAuthority: authority,
  }, {
    environment: { APP_VERSION: "v8.15.18", COMMIT_SHA: COMMIT },
    archivedInspector: async () => archive,
  });
  assert.equal(value.backendIdentityMatched, true);
  const invalid = await inspectBackendRuntimeReleaseIdentity({
    effectiveAuthority: authority,
  }, {
    environment: { APP_VERSION: "v8.15.18", RELEASE_SOURCE_COMMIT: "wrong", COMMIT_SHA: COMMIT },
    archivedInspector: async () => archive,
  });
  assert.equal(invalid.backendIdentityMatched, null);
});

test("the backend runtime identity route is permission-protected and UI read-only", async () => {
  const [routes, ui] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,
    /"\/module-catalogue\/backend-runtime-identity",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(ui, /API\.get\("\/system-administration\/module-catalogue\/backend-runtime-identity"\)/);
  assert.match(ui, /Even a match does not confirm the running container image/);
  assert.doesNotMatch(ui, /API\.(put|post|patch|delete)\(/);
});
