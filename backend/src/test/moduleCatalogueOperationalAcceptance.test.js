import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { summariseModuleOperationalGaps } from "../features/moduleCatalogue/moduleCatalogueGapSummary.js";
import { inspectModuleDependencyEvidence } from "../features/moduleCatalogue/moduleCatalogueDependencyEvidence.js";
import { inspectModuleContractDeclarations } from "../features/moduleCatalogue/moduleCatalogueContractEvidence.js";
import { buildModuleAcceptanceContract } from "../features/moduleCatalogue/moduleCatalogueAcceptanceContract.js";
import { listReviewedModuleTestEvidence, validateModuleTestEvidenceLedger } from "../platform/moduleCatalogue/moduleTestEvidenceLedger.js";
import { inspectExistingModuleImplementation } from "../platform/moduleCatalogue/moduleImplementationReferences.js";
import {
  inspectModuleOperationalAcceptance,
} from "../features/moduleCatalogue/moduleCatalogueOperationalAcceptance.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const authority = Object.freeze({
  businessId: BUSINESS,
  locationAccessMode: "all",
  permissions: ["feature-control:read"],
});
const tenants = [
  {
    moduleId: "01", manifestSelected: true, subscriptionEntitled: true,
    subscriptionStatus: "active",
  },
  {
    moduleId: "02", manifestSelected: true, subscriptionEntitled: false,
    subscriptionStatus: "active",
  },
  {
    moduleId: "19", manifestSelected: false, subscriptionEntitled: true,
    subscriptionStatus: "suspended",
  },
];
function fixture(records = tenants, integrity = "verified_manifest_and_subscription") {
  const seen = [];
  return {
    seen,
    tenantInspector: async ({ effectiveAuthority }) => {
      seen.push(effectiveAuthority);
      return {
        businessId: effectiveAuthority.businessId,
        integrity, entries: records,
      };
    },
  };
}

test("acceptance checklist reports evidenced tenant prerequisites without approving a module", async () => {
  const input = fixture();
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, input);
  assert.equal(result.assessmentCount, 48);
  assert.equal(result.acceptedCount, 0);
  assert.equal(result.assessmentNotApproval, true);
  assert.equal(result.readOnly, true);
  assert.equal(input.seen[0], authority);
  const appointments = result.entries.find((entry) => entry.moduleId === "01");
  assert.equal(appointments.readyForProductionAcceptance, false);
  assert.equal(appointments.productionAccepted, null);
  assert.equal(appointments.activationAuthorised, false);
  assert.equal(appointments.confirmedBlockers.length, 0);
  assert.ok(appointments.checks.some((check) =>
    check.key === "manifest_composition" && check.status === "evidence_present"));
  assert.ok(appointments.checks.some((check) =>
    check.key === "subscription_entitlement" && check.status === "evidence_present"));
  assert.ok(appointments.outstandingVerification.includes("module_api_acceptance"));
  assert.ok(appointments.outstandingVerification.includes("tenant_location_isolation"));
  assert.ok(appointments.outstandingVerification.includes("production_signoff"));
});

test("denied subscription and suspended lifecycle are confirmed blockers", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const workforce = result.entries.find((entry) => entry.moduleId === "02");
  assert.ok(workforce.confirmedBlockers.includes("subscription_entitlement"));
  const receptionist = result.entries.find((entry) => entry.moduleId === "19");
  assert.ok(receptionist.confirmedBlockers.includes("manifest_composition"));
  assert.ok(receptionist.confirmedBlockers.includes("subscription_lifecycle"));
  assert.equal(receptionist.readyForProductionAcceptance, false);
});

test("unmapped candidates and missing records stay unknown without invented failures", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture([], "missing_source_records"));
  const slot = result.entries.find((entry) => entry.moduleId === "22");
  assert.equal(slot.checks.find((check) =>
    check.key === "canonical_capability_mapping").status, "not_verified");
  assert.equal(slot.checks.find((check) =>
    check.key === "trusted_tenant_records").status, "not_verified");
  assert.equal(slot.checks.find((check) =>
    check.key === "subscription_entitlement").status, "not_verified");
  assert.equal(slot.confirmedBlockers.length, 0);
  assert.equal(slot.productionAccepted, null);
  assert.equal(result.entries.every((entry) => !entry.activationAuthorised), true);
});

test("tenant authority failures are propagated without returning catalogue evidence", async () => {
  for (const issue of ["membership denied", "business mismatch", "read permission denied"]) {
    await assert.rejects(inspectModuleOperationalAcceptance({
      effectiveAuthority: authority,
    }, {
      tenantInspector: async () => { throw new Error(issue); },
    }), new RegExp(issue));
  }
});

test("module management route enforces trusted authority and UI does not write state", async () => {
  const [routes, page] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,
    /"\/module-catalogue\/operational-acceptance",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /effectiveAuthority: request\.effectiveAuthority/);
  assert.match(page,
    /API\.get\("\/system-administration\/module-catalogue\/operational-acceptance"\)/);
  assert.match(page, /Production approval: not granted/);
  assert.doesNotMatch(page, /API\.(post|put|patch|delete)\(/);
});

test("catalogue delivery gap summary includes every requirement and candidate without implied approval", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const summary = result.deliveryGaps;
  assert.equal(summary.readOnly, true);
  assert.equal(summary.assessmentNotApproval, true);
  assert.equal(summary.activationAuthorised, false);
  assert.equal(summary.productionAcceptedCount, null);
  assert.equal(summary.totals.count, 48);
  assert.equal(summary.priorities.reduce((total, row) => total + row.count, 0), 48);
  assert.equal(summary.categories.reduce((total, row) => total + row.count, 0), 48);
  assert.deepEqual(summary.priorities.map((row) => row.priority), ["P0", "P1", "P2", "P3"]);
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "02" && row.confirmedBlockers.includes("subscription_entitlement")));
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "18" && row.aiOpportunity.includes("assistant")));
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "22" && row.canonicalMappingVerified === false));
  assert.ok(summary.entries.every((row) =>
    row.activationAuthorised === false && row.productionAccepted === null));
});

test("delivery-gap summary rejects duplicate or unknown identifiers and remains read-only", () => {
  const assessment = {
    moduleId: "01",
    checks: [{ key: "tenant_location_isolation", status: "not_verified" }],
  };
  const summary = summariseModuleOperationalGaps([assessment]);
  assert.equal(summary.entries[0].planningState, "verification_required");
  assert.equal(summary.totals.verificationRequired, 1);
  assert.equal(Object.isFrozen(summary.entries), true);
  assert.equal(Object.isFrozen(summary.entries[0]), true);
  assert.throws(() => summariseModuleOperationalGaps([assessment, assessment]), /Duplicate/);
  assert.throws(() => summariseModuleOperationalGaps([{ moduleId: "UNKNOWN", checks: [] }]),
    (error) => error.code === "UNKNOWN_MODULE_CATALOGUE_ID");
  assert.throws(() => summariseModuleOperationalGaps({}), TypeError);
});

test("module dependencies disclose trusted prerequisite evidence without claiming runtime acceptance", async () => {
  const inputs = [
    { moduleId: "18", capabilityPackKeys: ["ai"], manifestSelected: true,
      subscriptionEntitled: true, subscriptionStatus: "active" },
    { moduleId: "09", capabilityPackKeys: ["communications"], manifestSelected: true,
      subscriptionEntitled: false, subscriptionStatus: "active" },
    { moduleId: "01", capabilityPackKeys: ["appointments"], manifestSelected: true,
      subscriptionEntitled: true, subscriptionStatus: "trial" },
    { moduleId: "19", capabilityPackKeys: ["ai-receptionist"], manifestSelected: true,
      subscriptionEntitled: true, subscriptionStatus: "active" },
  ];
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture(inputs));
  const receptionist = result.entries.find((entry) => entry.moduleId === "19");
  assert.deepEqual(receptionist.expectedDependencies, ["ai", "communications", "appointments"]);
  assert.deepEqual(receptionist.dependencyEvidence.map((row) => row.state), [
    "prerequisites_evidenced", "confirmed_prerequisite_blocker", "prerequisites_evidenced",
  ]);
  assert.ok(receptionist.dependencyEvidence.every((row) =>
    row.operationallyAccepted === null && row.activationAuthorised === false));
  const summary = result.deliveryGaps.entries.find((row) => row.moduleId === "19");
  assert.deepEqual(summary.dependencyPrerequisiteBlockers, ["communications"]);
  assert.deepEqual(summary.dependencyVerificationNeeded, []);
  assert.equal(receptionist.checks.find((row) => row.key === "dependency_acceptance").status,
    "not_verified");
});

test("dependency evidence fails unknown on absent, contradictory and incomplete source records", () => {
  const result = inspectModuleDependencyEvidence(["ai", "commerce", "ai"], [
    { capabilityPackKeys: ["ai"], manifestSelected: true,
      subscriptionEntitled: true, subscriptionStatus: "active" },
    { capabilityPackKeys: ["ai"], manifestSelected: false,
      subscriptionEntitled: true, subscriptionStatus: "active" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].manifestSelected, null);
  assert.equal(result[0].state, "not_verified");
  assert.equal(result[1].state, "not_verified");
  assert.equal(result[1].subscriptionEntitled, null);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.deepEqual(inspectModuleDependencyEvidence([], []), []);
});

test("capability mapping review distinguishes unmapped candidates from taxonomy-only entries", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const summary = result.deliveryGaps;
  assert.equal(summary.totals.count, 48);
  const byId = (id) => summary.entries.find((entry) => entry.moduleId === id);
  assert.equal(byId("01").mappingReviewState, "canonical_mapping_recorded");
  assert.equal(byId("22").mappingReviewState, "taxonomy_only");
  assert.equal(byId("26").mappingReviewState, "taxonomy_only");
  assert.equal(byId("05").mappingReviewState, "mapping_review_required");
  assert.equal(byId("05").suggestedNextReview, "review_capability_mapping");
  assert.equal(byId("18").aiEvidenceState, "tool_contract_not_verified");
  assert.equal(byId("18").suggestedNextReview, "verify_ai_tool_contract_evidence");
  assert.equal(summary.totals.unmapped,
    summary.entries.filter((entry) => entry.mappingReviewState === "mapping_review_required").length);
  assert.equal(summary.totals.taxonomyOnly, 2);
  assert.equal(summary.totals.aiEvidenceUnverified,
    summary.entries.filter((entry) => entry.aiEvidenceState === "tool_contract_not_verified").length);
  assert.ok(summary.reviewQueue.some((item) => item.moduleId === "05"));
  assert.ok(!summary.reviewQueue.some((item) => item.moduleId === "22"));
  assert.ok(summary.reviewQueue.every((item) => item.activationAuthorised === false));
  assert.equal(Object.isFrozen(summary.reviewQueue), true);
  assert.equal(Object.isFrozen(summary.reviewQueue[0]), true);
  assert.deepEqual(summary.reviewQueue.map((item) => item.priority),
    [...summary.reviewQueue].map((item) => item.priority)
      .sort((a, b) => ["P0", "P1", "P2", "P3"].indexOf(a) - ["P0", "P1", "P2", "P3"].indexOf(b)));
});

test("AI opportunities remain planning-only and never constitute a verified tool or deployment", () => {
  const entries = summariseModuleOperationalGaps([
    { moduleId: "18", checks: [] },
    { moduleId: "MKT-01", checks: [] },
  ]).entries;
  assert.ok(entries[0].aiOpportunity);
  assert.equal(entries[0].aiEvidenceState, "tool_contract_not_verified");
  assert.equal(entries[0].activationAuthorised, false);
  assert.equal(entries[0].productionAccepted, null);
  assert.equal(entries[1].aiEvidenceState, "ai_integration_not_specified");
});

test("catalogue API and AI contract evidence comes only from canonical registry declarations", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const entries = result.entries;
  assert.equal(entries.length, 48);
  const appointments = entries.find((row) => row.moduleId === "01");
  assert.deepEqual(appointments.contractEvidence.registeredCapabilities, ["appointments"]);
  assert.equal(appointments.contractEvidence.apiRouteVerification, "not_verified");
  assert.equal(appointments.contractEvidence.apiOperationalAcceptance, "not_verified");
  assert.equal(appointments.contractEvidence.aiToolContractVerification, "not_verified");
  assert.equal(appointments.contractEvidence.activationAuthorised, false);
  const unmapped = entries.find((row) => row.moduleId === "05");
  assert.equal(unmapped.contractEvidence.declarationState, "capability_mapping_missing");
  assert.deepEqual(unmapped.contractEvidence.integrationContracts, []);
  assert.equal(result.deliveryGaps.totals.withDeclaredIntegrationContracts,
    result.deliveryGaps.entries.filter((row) =>
      row.integrationDeclarationState === "integration_contracts_declared").length);
});

test("integration declarations never substitute for verified API routes, tools or provider readiness", () => {
  const evidence = inspectModuleContractDeclarations([{
    key: "ai",
    integrationContracts: ["external-api-v1", "external-api-v1"],
    configurationDefinitions: ["provider-setting"],
    requiredPermissions: ["ai:use"],
  }], "AI assistant");
  assert.deepEqual(evidence.integrationContracts, ["external-api-v1"]);
  assert.deepEqual(evidence.configurationDefinitions, ["provider-setting"]);
  assert.deepEqual(evidence.requiredPermissions, ["ai:use"]);
  assert.equal(evidence.declarationState, "integration_contracts_declared");
  assert.equal(evidence.apiRouteVerification, "not_verified");
  assert.equal(evidence.aiToolContractVerification, "not_verified");
  assert.equal(evidence.externalProviderReadiness, "not_verified");
  assert.equal(evidence.activationAuthorised, false);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.integrationContracts), true);
  assert.throws(() => inspectModuleContractDeclarations({}), TypeError);
});

test("reviewed AI and catalogue source PRs are traceable without claiming an API or tool is operational", async () => {
  const assessment = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const ai = assessment.entries.find((entry) => entry.moduleId === "18");
  assert.equal(ai.contractEvidence.relatedSourceReviewState, "related_source_snapshots_present");
  assert.ok(ai.contractEvidence.relatedSourceReviews.some((record) => record.prNumber === 591));
  assert.ok(ai.contractEvidence.relatedSourceReviews.every((record) =>
    record.sourceOutcome === "related_work_merged" && record.sourceUrl.startsWith("https://github.com/")));
  assert.equal(ai.contractEvidence.aiToolContractVerification, "not_verified");
  assert.equal(ai.contractEvidence.apiOperationalAcceptance, "not_verified");
  assert.equal(ai.contractEvidence.activationAuthorised, false);
  const unreviewed = assessment.entries.find((entry) => entry.moduleId === "05");
  assert.equal(unreviewed.contractEvidence.relatedSourceReviewState, "not_reviewed");
  assert.deepEqual(unreviewed.contractEvidence.relatedSourceReviews, []);
  assert.equal(assessment.deliveryGaps.totals.withRelatedSourceReviews,
    assessment.deliveryGaps.entries.filter((row) => row.relatedSourceReviewCount > 0).length);
  assert.equal(Object.isFrozen(ai.contractEvidence.relatedSourceReviews), true);
  assert.equal(Object.isFrozen(ai.contractEvidence.relatedSourceReviews[0]), true);
});

test("all 48 module entries expose read-only API, tenant, RBAC and AI acceptance contracts", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  assert.equal(result.entries.length, 48);
  for (const entry of result.entries) {
    const contract = entry.acceptanceContract;
    assert.equal(contract.moduleId, entry.moduleId);
    assert.equal(contract.acceptanceEvidenceStatus, "not_verified");
    assert.equal(contract.routeInventoryVerified, false);
    assert.equal(contract.activationAuthorised, false);
    assert.equal(contract.productionAccepted, null);
    assert.ok(contract.verificationItems.includes("foreign_business_access_denied"));
    assert.ok(contract.verificationItems.includes("unauthorised_location_access_denied"));
    assert.ok(contract.verificationItems.includes("authenticated_api_route_inventory"));
    assert.ok(contract.verificationItems.includes("positive_and_negative_permission_tests"));
    assert.equal(Object.isFrozen(contract), true);
    assert.equal(Object.isFrozen(contract.verificationItems), true);
    assert.deepEqual(contract.requiredPermissionDefinitions, entry.requiredPermissionDefinitions);
  }
});

test("AI and registered provider contracts require additional evidence, not inferred endpoints", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const ai = result.entries.find((entry) => entry.moduleId === "19").acceptanceContract;
  assert.ok(ai.expectedDependencies.includes("appointments"));
  assert.ok(ai.verificationItems.includes("ai_tool_tenant_and_permission_enforcement"));
  assert.ok(ai.verificationItems.includes("ai_tool_failure_and_prompt_injection_tests"));
  assert.equal(ai.aiToolRegistryBindingVerified, false);
  const taxonomy = result.entries.find((entry) => entry.moduleId === "22").acceptanceContract;
  assert.equal(taxonomy.contractType, "taxonomy_only");
  const unmapped = result.entries.find((entry) => entry.moduleId === "05").acceptanceContract;
  assert.equal(unmapped.contractType, "unmapped_planning_review");
  assert.deepEqual(unmapped.capabilityPackKeys, []);
  assert.throws(() => buildModuleAcceptanceContract(null), TypeError);
  const declared = buildModuleAcceptanceContract({
    moduleId: "X", capabilityPackKeys: ["ai"], aiOpportunity: "Assistant",
  }, { contractEvidence: { integrationContracts: ["provider-api"] } });
  assert.ok(declared.verificationItems.includes("integration_contract_compatibility_tests"));
  assert.ok(declared.verificationItems.includes("provider_credentials_and_callback_validation"));
  assert.equal(declared.routeInventoryVerified, false);
});

test("P0 catalogue items reference reviewed test source without claiming isolated CI execution or acceptance", async () => {
  const assessment = await inspectModuleOperationalAcceptance({ effectiveAuthority: authority }, fixture());
  assert.equal(assessment.testEvidenceIntegrity.valid, true);
  assert.equal(assessment.testEvidenceIntegrity.perTestExecutionVerified, false);
  assert.ok(assessment.testEvidenceIntegrity.reviewedTestSourceCount >= 5);
  const ai = assessment.entries.find((row) => row.moduleId === "18");
  assert.ok(ai.reviewedTestSourceEvidence.some((record) =>
    record.path === "backend/src/test/aiAdviserV2.test.js"));
  assert.ok(ai.reviewedTestSourceEvidence.some((record) =>
    record.path === "backend/src/test/aiWorkforceReadOnlyMetricsInvocation.test.js"));
  for (const record of ai.reviewedTestSourceEvidence) {
    assert.equal(record.sourceType, "reviewed_test_source");
    assert.equal(record.executedInThisInspection, false);
    assert.equal(record.perTestCiConclusion, null);
    assert.equal(record.tenantAcceptance, null);
    assert.equal(record.productionAccepted, null);
  }
  assert.ok(assessment.entries.find((row) => row.moduleId === "CORE-02")
    .reviewedTestSourceEvidence.some((record) =>
      record.path === "backend/src/test/moduleCatalogueTenantRuntimeEvidence.test.js"));
  assert.ok(assessment.entries.find((row) => row.moduleId === "11")
    .reviewedTestSourceEvidence.some((record) => record.path.endsWith("/integrationRegistry.test.js")));
  assert.equal(ai.checks.find((row) => row.key === "module_api_acceptance").status, "not_verified");
});

test("reviewed test source ledger refuses wrong IDs and returns immutable evidence", () => {
  const ai = listReviewedModuleTestEvidence("18");
  assert.ok(ai.length > 0);
  assert.equal(Object.isFrozen(ai), true);
  assert.equal(Object.isFrozen(ai[0]), true);
  const allIds = [...new Set([
    ...["CORE-01", "CORE-02", "CORE-03", "CORE-04", "11", "16", "18"],
    ...["AI-CORE-01", "AI-CORE-02", "AI-CORE-04", "AI-CORE-05"],
  ])];
  assert.equal(validateModuleTestEvidenceLedger(allIds).valid, true);
  assert.throws(() => validateModuleTestEvidenceLedger(["18"]), /Invalid module test source evidence mapping/);
  assert.deepEqual(listReviewedModuleTestEvidence("UNKNOWN"), []);
});

test("reviewed P0 test inventory covers tenant provisioning, integration registry and AI governance boundaries", async () => {
  const assessment = await inspectModuleOperationalAcceptance({ effectiveAuthority: authority }, fixture());
  const byId = (id) => assessment.entries.find((row) => row.moduleId === id);
  const expected = [
    ["CORE-01", "saasControlPlaneV3.test.js"],
    ["CORE-03", "integrationApiAuth.test.js"],
    ["CORE-04", "saasControlPlaneV3.test.js"],
    ["11", "integrationRegistry.test.js"],
    ["AI-CORE-01", "aiWorkforceCore.test.js"],
    ["AI-CORE-02", "aiWorkforceAuditReconciliation.test.js"],
    ["AI-CORE-04", "aiWorkforceReadDeadline.test.js"],
    ["AI-CORE-05", "aiWorkforceGovernance.test.js"],
  ];
  for (const [moduleId, filename] of expected) {
    const entry = byId(moduleId);
    assert.ok(entry, `Missing P0 module ${moduleId}`);
    assert.ok(entry.reviewedTestSourceEvidence.some((record) =>
      record.path.endsWith("/" + filename)), `Missing reviewed source mapping ${moduleId}`);
    assert.equal(entry.acceptanceContract.activationAuthorised, false);
    assert.equal(entry.checks.find((item) => item.key === "module_api_acceptance").status,
      "not_verified");
  }
  // A recorded test source remains only traceability, not an independent
  // per-test CI result or a module-wide acceptance decision.
  assert.equal(assessment.testEvidenceIntegrity.perTestExecutionVerified, false);
  assert.equal(byId("AI-CORE-03").reviewedTestSourceEvidence.length, 0);
  assert.equal(assessment.entries.every((entry) => entry.productionAccepted === null), true);
});

test("existing P1 business modules are recorded as source-present without reimplementation or activation", async () => {
  const assessment = await inspectModuleOperationalAcceptance({ effectiveAuthority: authority }, fixture());
  const mounted = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const modules = [
    ["01", "/api/appointments", "backend/src/routes/appointmentRoutes.js"],
    ["02", "/api/stylists", "backend/src/routes/stylistRoutes.js"],
    ["03", "/api/services", "backend/src/routes/serviceRoutes.js"],
    ["04", "/api/commerce", "backend/src/features/commerce/commerceRoutes.js"],
    ["09", "/api/message-delivery", "backend/src/routes/messageDeliveryRoutes.js"],
  ];
  for (const [id, mount, routeFile] of modules) {
    const entry = assessment.entries.find((row) => row.moduleId === id);
    const record = entry.implementationReference;
    assert.equal(record.sourceState, "existing_implementation_source_reviewed");
    assert.equal(record.existingImplementationReview, true);
    assert.ok(record.apiMounts.includes(mount));
    assert.ok(record.routeSources.includes(routeFile));
    assert.ok(mounted.includes(`"${mount}"`), `Unregistered implementation mount ${mount}`);
    assert.equal(record.runtimeVerified, null);
    assert.equal(record.productionAccepted, null);
    assert.equal(record.activationAuthorised, false);
    assert.equal(Object.isFrozen(record.routeSources), true);
    assert.equal(Object.isFrozen(record.apiMounts), true);
    assert.equal(entry.checks.find((check) => check.key === "module_api_acceptance").status,
      "not_verified");
    const source = await readFile(new URL("../" + routeFile.slice("backend/src/".length), import.meta.url), "utf8");
    assert.match(source, /router\.(get|post|patch|put|delete|use)\(/);
  }
  const unknown = inspectExistingModuleImplementation("12");
  assert.equal(unknown.sourceState, "not_reviewed_in_this_inventory");
  assert.equal(unknown.existingImplementationReview, null);
  assert.equal(unknown.activationAuthorised, false);
});
