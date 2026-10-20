import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationDatasetSnapshot,
  verifyConsultationDatasetSnapshot,
} from "../features/consultations/consultationDatasetSnapshot.js";

const session = {
  _id: "64f000000000000000000211",
  business: "64f000000000000000000201",
  location: "64f000000000000000000202",
  consultationType: "hair-colour-chemical",
  definitionVersion: "1",
  status: "closed",
  structuredFeatures: {
    currentColour: "brown",
    desiredOutcome: "copper",
  },
  deterministicAssessment: {
    rulesetVersion: "hair-colour-chemical-rules-v1",
    bookingBlocked: false,
    flags: [],
  },
  ai: {},
  review: {
    decision: "approved",
    corrections: [],
  },
  outcome: {
    finalDecision: "closed",
    bookingConverted: false,
    servicePerformed: false,
    customerAcceptedRecommendation: true,
    observedAt: new Date("2026-10-19T15:30:00.000Z"),
  },
  governance: {
    dataProcessingConsent: true,
  },
};

test("consultation snapshot fingerprint remains valid after JSON transport", () => {
  const snapshot = buildConsultationDatasetSnapshot([session], {
    datasetVersion: "transport-v1",
    source: { kind: "synthetic" },
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
  });

  const transported = JSON.parse(JSON.stringify(snapshot));
  assert.equal(transported.records[0].observedAt, "2026-10-19T15:30:00.000Z");
  assert.equal(verifyConsultationDatasetSnapshot(transported), true);
});
