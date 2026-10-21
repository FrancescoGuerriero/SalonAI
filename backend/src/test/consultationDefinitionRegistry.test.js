import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefinitionInferenceRequest,
  getConsultationDefinition,
  listConsultationDefinitions,
} from "../features/consultations/consultationDefinitionRegistry.js";

test("consultation definition registry exposes the active hair-colour vertical", () => {
  const definition = getConsultationDefinition("hair-colour-chemical", "1");

  assert.equal(definition?.active, true);
  assert.equal(definition?.vertical, "salon");
  assert.equal(definition?.humanReviewRequired, true);
  assert.equal(definition?.media?.consentRequired, true);
  assert.ok(definition?.featureKeys.includes("desiredOutcome"));
  assert.deepEqual(
    listConsultationDefinitions().map((item) => item.id),
    ["hair-colour-chemical"]
  );
});

test("definition-based inference preserves trusted tenant and deterministic authority", () => {
  const request = buildDefinitionInferenceRequest({
    session: {
      business: "64f000000000000000000001",
      location: "64f000000000000000000002",
      consultationType: "hair-colour-chemical",
      definitionVersion: "1",
    },
    features: {
      desiredOutcome: "lighter",
      currentColour: "brown",
      hairCondition: "good",
      colourHistory: "none",
      bleachHistory: "none",
      sensitivities: "none",
    },
  });

  assert.equal(request.consultationType, "hair-colour-chemical");
  assert.equal(request.definitionVersion, "1");
  assert.equal(request.tenantContext.businessId, "64f000000000000000000001");
  assert.equal(request.constraints.humanReviewRequired, true);
  assert.equal(request.constraints.canonicalWritesAllowed, false);
  assert.equal(request.deterministicAssessment.bookingBlocked, false);
});

test("unsupported consultation definitions fail closed", () => {
  assert.equal(getConsultationDefinition("unknown-vertical", "1"), null);
  assert.throws(
    () =>
      buildDefinitionInferenceRequest({
        session: {
          business: "64f000000000000000000001",
          location: "64f000000000000000000002",
          consultationType: "unknown-vertical",
          definitionVersion: "1",
        },
      }),
    /not active or its version is unsupported/
  );
});
