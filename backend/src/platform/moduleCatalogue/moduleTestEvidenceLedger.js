/**
 * DEV1-reviewed test SOURCE inventory (2026-11-08).
 * The listed test files and assertions were checked against this branch.
 * This is NOT a per-test run report, tenant acceptance or production sign-off.
 * No file-system search or external requests occur at API request time.
 */
const REVIEWED_AT = "2026-11-08";
const TESTS = Object.freeze([
  {
    path: "backend/src/test/canonicalModuleCatalogue.test.js",
    verifies: "Canonical taxonomy identifiers, mapped capability metadata and no-activation projection",
    moduleIds: ["CORE-02"],
  },
  {
    path: "backend/src/test/moduleCatalogueTenantRuntimeEvidence.test.js",
    verifies: "Tenant-wide membership, manifest integrity, foreign ownership and absent-record rejection",
    moduleIds: ["CORE-02"],
  },
  {
    path: "backend/src/test/moduleCatalogueOperationalAcceptance.test.js",
    verifies: "Read-only tenant module prerequisite checklist, authority propagation and unknown-state preservation",
    moduleIds: ["CORE-02"],
  },
  {
    path: "backend/src/test/aiWorkforceReadOnlyMetricsInvocation.test.js",
    verifies: "Governed read-only metrics invocation, tenant/location denials, failure auditing and metric validation",
    moduleIds: ["16", "18", "AI-CORE-01", "AI-CORE-02"],
  },
  {
    path: "backend/src/test/aiAdviserV2.test.js",
    verifies: "AI Adviser route protection, registered tool boundaries and no unsupported action claims",
    moduleIds: ["18", "AI-CORE-01", "AI-CORE-02"],
  },
  {
    path: "backend/src/test/moduleCatalogueBackendRuntimeIdentity.test.js",
    verifies: "Backend release identity comparison and permission-gated read-only inspection",
    moduleIds: ["CORE-02"],
  },
]);
const freeze = (items) => Object.freeze([...items]);

export function listReviewedModuleTestEvidence(moduleId) {
  return freeze(TESTS.filter((item) => item.moduleIds.includes(String(moduleId)))
    .map((item) => Object.freeze({
      sourceType: "reviewed_test_source",
      path: item.path,
      verifies: item.verifies,
      reviewedAt: REVIEWED_AT,
      executedInThisInspection: false,
      perTestCiConclusion: null,
      tenantAcceptance: null,
      productionAccepted: null,
    })));
}

export function validateModuleTestEvidenceLedger(knownModuleIds = []) {
  const known = new Set(knownModuleIds);
  const paths = new Set();
  for (const item of TESTS) {
    if (!/^backend\/src\/test\/[a-zA-Z0-9]+\.test\.js$/.test(item.path) ||
      paths.has(item.path) || !item.moduleIds.length ||
      item.moduleIds.some((id) => !known.has(id)) ||
      !item.verifies.trim()) {
      throw new Error("Invalid module test source evidence mapping.");
    }
    paths.add(item.path);
  }
  return Object.freeze({
    valid: true,
    reviewedAt: REVIEWED_AT,
    reviewedTestSourceCount: paths.size,
    linkedModuleCount: new Set(TESTS.flatMap((item) => item.moduleIds)).size,
    perTestExecutionVerified: false,
    productionAccepted: false,
  });
}
