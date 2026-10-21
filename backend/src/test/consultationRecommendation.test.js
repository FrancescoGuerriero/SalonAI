import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseConsultationRecommendation,
} from "../features/consultations/consultationRecommendationService.js";

test("consultation recommendation accepts valid optional identifiers", () => {
  const result = normaliseConsultationRecommendation({
    recommendedServiceId: "64f000000000000000000004",
    recommendedStylistId: "64f000000000000000000005",
  });

  assert.equal(result.hasService, true);
  assert.equal(result.hasStylist, true);
  assert.equal(result.serviceId, "64f000000000000000000004");
  assert.equal(result.stylistId, "64f000000000000000000005");
});

test("consultation recommendation supports deliberate clearing", () => {
  const result = normaliseConsultationRecommendation({
    recommendedStylistId: "",
  });

  assert.equal(result.hasService, false);
  assert.equal(result.hasStylist, true);
  assert.equal(result.stylistId, null);
});

test("consultation recommendation rejects missing or malformed input", () => {
  assert.throws(
    () => normaliseConsultationRecommendation({}),
    /service or stylist recommendation is required/
  );

  assert.throws(
    () =>
      normaliseConsultationRecommendation({
        recommendedServiceId: "not-an-id",
      }),
    /valid identifier/
  );
});
