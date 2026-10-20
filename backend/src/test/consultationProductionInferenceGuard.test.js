import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConsultationReviewable,
  assertConsultationReviewAssignable,
  consultationInferenceEnabled,
} from "../features/consultations/consultationSessionService.js";

test("production consultation inference requires both enablement and explicit production approval", () => {
  assert.equal(
    consultationInferenceEnabled({
      NODE_ENV: "production",
      CONSULTATION_AI_INFERENCE_ENABLED: "true",
    }),
    false
  );
  assert.equal(
    consultationInferenceEnabled({
      NODE_ENV: "production",
      CONSULTATION_AI_INFERENCE_ENABLED: "true",
      CONSULTATION_AI_PRODUCTION_APPROVED: "false",
    }),
    false
  );
  assert.equal(
    consultationInferenceEnabled({
      NODE_ENV: "production",
      CONSULTATION_AI_INFERENCE_ENABLED: "true",
      CONSULTATION_AI_PRODUCTION_APPROVED: "true",
    }),
    true
  );
});

test("human review decisions are accepted only in review-stage sessions", () => {
  for (const status of ["awaiting_review", "in_person_required"]) {
    assert.doesNotThrow(() => assertConsultationReviewable(status));
  }
  for (const status of [
    "draft",
    "in_progress",
    "more_information_required",
    "approved",
    "booking_ready",
    "booked",
    "closed",
    "archived",
  ]) {
    assert.throws(
      () => assertConsultationReviewable(status),
      (error) => error?.code === "CONSULTATION_NOT_AWAITING_REVIEW"
    );
  }
});

test("review assignment is limited to sessions that can still enter review", () => {
  for (const status of [
    "draft",
    "in_progress",
    "awaiting_review",
    "more_information_required",
    "in_person_required",
  ]) {
    assert.doesNotThrow(() => assertConsultationReviewAssignable(status));
  }
  for (const status of ["approved", "booking_ready", "booked", "closed", "archived"]) {
    assert.throws(
      () => assertConsultationReviewAssignable(status),
      (error) => error?.code === "CONSULTATION_REVIEW_FINALISED"
    );
  }
});
