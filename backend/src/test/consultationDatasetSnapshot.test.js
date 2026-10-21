import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationDatasetSnapshot,
  verifyConsultationDatasetSnapshot,
} from "../features/consultations/consultationDatasetSnapshot.js";

function eligibleSession(overrides = {}) {
  return {
    _id: "64f000000000000000000111",
    business: "64f000000000000000000001",
    location: "64f000000000000000000002",
    consultationType: "hair-colour-chemical",
    definitionVersion: "1",
    status: "closed",
    structuredFeatures: {
      currentColour: "medium brown",
      desiredOutcome: "copper",
      hairCondition: "good",
      privateNotes: "must not enter the learning record",
    },
    deterministicAssessment: {
      rulesetVersion: "hair-colour-chemical-rules-v1",
      bookingBlocked: false,
      flags: [],
    },
    ai: {
      modelName: "salonai-consultation-structured-baseline",
      modelVersion: "1",
      promptVersion: "foundation-v1",
      featureVersion: "hair-colour-consultation-features-v1",
      datasetVersion: "not-applicable-foundation-v1",
      confidence: 0.72,
    },
    review: {
      decision: "approved",
      corrections: [],
    },
    outcome: {
      finalDecision: "closed",
      bookingConverted: true,
      servicePerformed: true,
      customerAcceptedRecommendation: true,
      observedAt: new Date("2026-10-19T12:00:00.000Z"),
    },
    governance: {
      dataProcessingConsent: true,
    },
    ...overrides,
  };
}

test("dataset snapshot contains only eligible pseudonymised learning records", () => {
  const snapshot = buildConsultationDatasetSnapshot(
    [
      eligibleSession(),
      eligibleSession({
        _id: "64f000000000000000000112",
        governance: { dataProcessingConsent: false },
      }),
    ],
    {
      datasetVersion: "synthetic-eval-v1",
      source: { kind: "synthetic" },
      createdAt: new Date("2026-10-20T00:00:00.000Z"),
    }
  );

  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.manifest.statistics.inputSessions, 2);
  assert.equal(snapshot.manifest.statistics.eligibleRecords, 1);
  assert.equal(snapshot.manifest.statistics.excludedSessions, 1);
  assert.equal(
    snapshot.manifest.statistics.exclusionReasons["operational-consent-not-recorded"],
    1
  );
  assert.equal(snapshot.manifest.trainingAuthorised, false);
  assert.equal(snapshot.manifest.source.directProductionDatabaseAccess, false);
  assert.equal(snapshot.manifest.privacy.pseudonymisedKeysOnly, true);
  assert.notEqual(snapshot.records[0].tenantKey, "64f000000000000000000001");
  assert.equal(Object.hasOwn(snapshot.records[0], "customer"), false);
  assert.equal(Object.hasOwn(snapshot.records[0].features, "privateNotes"), false);
  assert.equal(verifyConsultationDatasetSnapshot(snapshot), true);
});

test("dataset snapshot fingerprint is deterministic across source ordering", () => {
  const first = eligibleSession({ _id: "64f000000000000000000120" });
  const second = eligibleSession({ _id: "64f000000000000000000119" });
  const options = {
    datasetVersion: "fixture-v1",
    source: { kind: "test-fixture" },
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
  };

  const left = buildConsultationDatasetSnapshot([first, second], options);
  const right = buildConsultationDatasetSnapshot([second, first], options);

  assert.equal(left.manifest.fingerprint, right.manifest.fingerprint);
  assert.deepEqual(left.records, right.records);
});

test("tampering invalidates a governed snapshot fingerprint", () => {
  const snapshot = buildConsultationDatasetSnapshot([eligibleSession()], {
    datasetVersion: "fixture-v1",
    source: { kind: "test-fixture" },
  });

  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.records[0].labels.bookingConverted = false;
  assert.equal(verifyConsultationDatasetSnapshot(tampered), false);
});

test("production-derived snapshot contract requires an explicit approval reference", () => {
  assert.throws(
    () =>
      buildConsultationDatasetSnapshot([eligibleSession()], {
        datasetVersion: "governed-export-v1",
        source: { kind: "approved-governed-export" },
      }),
    (error) =>
      error?.code === "CONSULTATION_DATASET_APPROVAL_REQUIRED" &&
      error?.statusCode === 400
  );

  const snapshot = buildConsultationDatasetSnapshot([eligibleSession()], {
    datasetVersion: "governed-export-v1",
    source: {
      kind: "approved-governed-export",
      approvalReference: "change-control-reference-only",
    },
  });
  assert.equal(snapshot.manifest.trainingAuthorised, false);
  assert.equal(snapshot.manifest.source.approvalReference, "change-control-reference-only");
});

test("dataset snapshot use policy cannot silently authorise training", () => {
  assert.throws(
    () =>
      buildConsultationDatasetSnapshot([eligibleSession()], {
        datasetVersion: "fixture-v1",
        source: { kind: "synthetic" },
        usePolicy: "production-training",
      }),
    (error) => error?.code === "INVALID_CONSULTATION_DATASET_SNAPSHOT"
  );
});
