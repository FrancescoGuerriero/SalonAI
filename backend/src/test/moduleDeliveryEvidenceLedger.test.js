import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_DELIVERY_EVIDENCE_REVIEWED_AT,
  listVerifiedModuleDeliveryEvidence,
  inspectModuleDeliveryMilestones,
  validateModuleDeliveryEvidenceLedger,
} from "../platform/moduleCatalogue/moduleDeliveryEvidenceLedger.js";
import { listModuleCatalogue } from "../platform/moduleCatalogue/canonicalModuleCatalogue.js";
import { getAdministrativeModuleCatalogue } from "../features/moduleCatalogue/moduleCatalogueController.js";

test("reviewed evidence references existing module IDs and genuine, unique merge commits", () => {
  const allIds = listModuleCatalogue({ includeCandidates: true }).map((entry) => entry.moduleId);
  const result = validateModuleDeliveryEvidenceLedger(allIds);
  assert.equal(result.valid, true);
  assert.equal(result.sourcePrCount, 11);
  assert.equal(result.reviewedAt, MODULE_DELIVERY_EVIDENCE_REVIEWED_AT);
  const allEntries = getAdministrativeModuleCatalogue().entries;
  assert.equal(allEntries.length, 48);
  assert.equal(new Set(allEntries.map((entry) => entry.moduleId)).size, 48);
});

test("marketing and central AI PRs have accurate, bounded source evidence", () => {
  const marketing = listVerifiedModuleDeliveryEvidence("MKT-06");
  assert.equal(marketing.length, 1);
  assert.equal(marketing[0].prNumber, 586);
  assert.equal(marketing[0].mergeCommitSha, "e286324d3de8e5a65adaa9109746043cb6a8775c");
  assert.ok(marketing[0].checks.some((check) => check.name === "DEV1 Marketing Editorial and Backlink Gate"));
  assert.equal(marketing[0].deployed, null);
  const ai = listVerifiedModuleDeliveryEvidence("18");
  assert.ok(ai.some((record) => record.prNumber === 591));
  assert.ok(ai.some((record) => record.prNumber === 590));
  const analytics = inspectModuleDeliveryMilestones("16");
  assert.equal(analytics.relatedSourceWorkMerged, true);
  assert.equal(analytics.recordedCiSuccess, true);
  assert.equal(analytics.runtimeVerified, null);
  assert.equal(analytics.productionAccepted, null);
});

test("catalogue dashboard PR evidence proves only reviewed partial source work", () => {
  const catalogue = listVerifiedModuleDeliveryEvidence("CORE-02");
  assert.ok(catalogue.some((record) => record.prNumber === 598));
  assert.ok(catalogue.some((record) => record.prNumber === 599));
  const verified = catalogue.find((record) => record.prNumber === 599);
  assert.equal(verified.checks.length, 5);
  assert.ok(verified.checks.every((check) => check.conclusion === "success"));
  assert.equal(verified.checks[0].commitSha, "a04dace00d1dc6fc12374a601710149f5d6f2560");
  assert.equal(verified.sourceOutcome, "related_work_merged");
  assert.equal(Object.hasOwn(verified, "moduleComplete"), false);
  assert.equal(Object.hasOwn(verified, "activationAuthorised"), false);
});

test("reverted quota feature is never represented as an active module or entitlement", () => {
  const changes = listVerifiedModuleDeliveryEvidence("AI-CORE-01");
  assert.ok(changes.some((record) =>
    record.prNumber === 597 && /Revert unplanned monthly AI quotas/.test(record.description)));
  assert.ok(!changes.some((record) => record.prNumber === 596));
  assert.ok(!getAdministrativeModuleCatalogue().entries.some((entry) =>
    entry.moduleId === "ai-a0-metrics-monthly"));
});

test("unknown evidence and absent CI remain unknown, not false positives", () => {
  assert.deepEqual(listVerifiedModuleDeliveryEvidence("22"), []);
  assert.deepEqual(listVerifiedModuleDeliveryEvidence("VERT-02"), []);
  const future = inspectModuleDeliveryMilestones("VERT-02");
  assert.equal(future.relatedSourceWorkMerged, null);
  assert.equal(future.recordedCiSuccess, null);
  assert.equal(future.deployed, null);
  assert.equal(future.productionAccepted, null);
  const partial = listVerifiedModuleDeliveryEvidence("AI-CORE-02").find((row) => row.prNumber === 594);
  assert.ok(partial);
  assert.equal(partial.checks.length, 0);
  assert.equal(partial.productionAccepted, null);
});
