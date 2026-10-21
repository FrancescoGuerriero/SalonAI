import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationOutcomeObservation,
} from "../features/consultations/consultationOutcomeObservationService.js";

const consultation = {
  outcome: {
    recommendedService: "64f000000000000000000004",
    recommendedStylist: "64f000000000000000000005",
  },
};

function appointment(status, overrides = {}) {
  return {
    status,
    service: "64f000000000000000000004",
    stylist: "64f000000000000000000005",
    completedAt: "2026-10-21T15:00:00.000Z",
    cancelledAt: "2026-10-21T15:00:00.000Z",
    noShowAt: "2026-10-21T15:00:00.000Z",
    ...overrides,
  };
}

test("completed appointment produces a fully labelled consultation outcome", () => {
  const observation = buildConsultationOutcomeObservation(
    appointment("completed"),
    consultation
  );

  assert.equal(observation.status, "closed");
  assert.equal(observation.outcome.finalDecision, "service_completed");
  assert.equal(observation.outcome.bookingConverted, true);
  assert.equal(observation.outcome.servicePerformed, true);
  assert.equal(observation.outcome.customerAcceptedRecommendation, true);
  assert.equal(observation.learning.labelState, "labelled");
});

test("cancelled and no-show appointments remain negative performed-service labels", () => {
  assert.equal(
    buildConsultationOutcomeObservation(appointment("cancelled"), consultation)
      .outcome.servicePerformed,
    false
  );
  assert.equal(
    buildConsultationOutcomeObservation(appointment("no_show"), consultation)
      .outcome.finalDecision,
    "no_show"
  );
});

test("recommendation acceptance is false when the booked service differs", () => {
  const observation = buildConsultationOutcomeObservation(
    appointment("completed", {
      service: "64f000000000000000000099",
    }),
    consultation
  );

  assert.equal(observation.outcome.customerAcceptedRecommendation, false);
});

test("recommendation acceptance stays unknown when no recommendation was recorded", () => {
  const observation = buildConsultationOutcomeObservation(
    appointment("completed"),
    { outcome: {} }
  );

  assert.equal(observation.outcome.customerAcceptedRecommendation, null);
});

test("non-terminal appointments do not create learning observations", () => {
  assert.equal(
    buildConsultationOutcomeObservation(appointment("confirmed"), consultation),
    null
  );
});
