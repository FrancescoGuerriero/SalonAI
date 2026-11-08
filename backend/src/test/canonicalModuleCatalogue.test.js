import test from "node:test";
import assert from "node:assert/strict";
import {
  MODULE_CATEGORIES,
  CANONICAL_MODULE_REQUIREMENTS,
  MODULE_CANDIDATES,
  listModuleCatalogue,
  getModuleCatalogueEntry,
  inspectModuleCatalogueStatus,
  validateModuleCatalogueIntegrity,
} from "../platform/moduleCatalogue/canonicalModuleCatalogue.js";
import { listCapabilityPacks } from "../platform/capabilities/capabilityRegistry.js";

test("AIIBP v3 taxonomy preserves exactly 27 requirement IDs, 21 candidate IDs, 15 categories", () => {
  assert.deepEqual(validateModuleCatalogueIntegrity(), {
    valid: true, requirementCount: 27, candidateCount: 21, categoryCount: 15,
  });
  assert.equal(MODULE_CATEGORIES.length, 15);
  assert.deepEqual(CANONICAL_MODULE_REQUIREMENTS.map((r) => r.moduleId),
    Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, "0")));
  assert.equal(MODULE_CANDIDATES.length, 21);
  assert.equal(new Set([...CANONICAL_MODULE_REQUIREMENTS, ...MODULE_CANDIDATES]
    .map((r) => r.moduleId)).size, 48);
});

test("27 requirements are not treated as 27 deployable capability packs", () => {
  assert.equal(CANONICAL_MODULE_REQUIREMENTS.length, 27);
  assert.notEqual(listCapabilityPacks().length, 27);
  assert.equal(getModuleCatalogueEntry("22").taxonomyOnly, true);
  assert.equal(getModuleCatalogueEntry("26").taxonomyOnly, true);
  assert.equal(getModuleCatalogueEntry("22").lifecycle, "research");
  assert.deepEqual(getModuleCatalogueEntry("26").capabilityPackKeys, []);
  assert.equal(getModuleCatalogueEntry("18").entitlementKey, "ai");
  assert.equal(getModuleCatalogueEntry("23").entitlementKey, "clinical-records");
});

test("existing capability mappings use canonical registration and permissions", () => {
  const known = new Set(listCapabilityPacks().map((p) => p.key));
  for (const row of listModuleCatalogue({ includeCandidates: true })) {
    assert.ok(MODULE_CATEGORIES.includes(row.category));
    assert.equal(row.owner, "DEV1");
    assert.equal(row.deploymentStatus, "unknown");
    assert.equal(row.productionAcceptance, "unknown");
    assert.equal(row.lastReviewedAt, null);
    for (const key of row.capabilityPackKeys) assert.ok(known.has(key));
    assert.equal(Object.isFrozen(row), true);
  }
  assert.deepEqual(getModuleCatalogueEntry("19").dependencies, [
    "ai", "communications", "appointments",
  ]);
  assert.deepEqual(getModuleCatalogueEntry("20").permissions, [
    "ai:use", "retention-automation:manage",
  ]);
});

test("priority and category filters work without changing identities", () => {
  const p0 = listModuleCatalogue({ priority: "P0" });
  assert.ok(p0.some((entry) => entry.moduleId === "18"));
  assert.ok(!p0.some((entry) => entry.moduleId === "01"));
  assert.equal(listModuleCatalogue().length, 27);
  assert.equal(listModuleCatalogue({ includeCandidates: true }).length, 48);
  assert.ok(listModuleCatalogue({
    category: "Marketing, Advertising, SEO and Social Media",
    includeCandidates: true,
  }).some((entry) => entry.moduleId === "MKT-06"));
  assert.throws(() => listModuleCatalogue({ category: "unregistered" }));
  assert.throws(() => listModuleCatalogue({ priority: "P9" }));
  assert.throws(() => getModuleCatalogueEntry("00"),
    (error) => error.code === "UNKNOWN_MODULE_CATALOGUE_ID");
});

test("planning presence cannot authorise deployment, provider use or production acceptance", () => {
  const unknown = inspectModuleCatalogueStatus("01");
  assert.equal(unknown.catalogueVisible, true);
  assert.equal(unknown.entitled, null);
  assert.equal(unknown.configured, null);
  assert.equal(unknown.providerVerified, null);
  assert.equal(unknown.ingestionActive, null);
  assert.equal(unknown.productionAccepted, null);
  assert.equal(unknown.activationAuthorised, false);
  const composition = { capabilities: [{
    key: "appointments", enabled: true, reason: "vertical-default",
  }] };
  assert.equal(inspectModuleCatalogueStatus("01", { composition }).entitled, null);
  const evidenced = inspectModuleCatalogueStatus("01", {
    composition,
    entitlementEvidence: ["appointments"],
    configured: true,
    providerVerified: true,
    ingestionActive: true,
    productionAccepted: true,
  });
  assert.equal(evidenced.entitled, true);
  assert.equal(evidenced.activationAuthorised, false);
  assert.equal(evidenced.deploymentStatus, "unknown");
  assert.equal(inspectModuleCatalogueStatus("01", {
    composition: { capabilities: [{
      key: "appointments", enabled: false, reason: "not-entitled",
    }] },
  }).entitled, false);
});

test("roadmap snapshot statuses remain explicitly unverified", () => {
  assert.match(getModuleCatalogueEntry("14").sourceStatus, /roadmap snapshot/);
  assert.match(getModuleCatalogueEntry("MKT-06").sourceStatus, /roadmap snapshot/);
  assert.equal(getModuleCatalogueEntry("MKT-06").productionAcceptance, "unknown");
  assert.equal(getModuleCatalogueEntry("VERT-02").entitlementKey, null);
});
