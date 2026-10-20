import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssignedReviewer,
  assertConsultationAssistable,
} from "../features/consultations/consultationSessionService.js";

const REVIEWER_A = "64f000000000000000000010";
const REVIEWER_B = "64f000000000000000000011";

test("assigned consultation review cannot be silently taken over", () => {
  assert.doesNotThrow(() => assertAssignedReviewer(REVIEWER_A, REVIEWER_A));
  assert.doesNotThrow(() => assertAssignedReviewer(null, REVIEWER_B));
  assert.throws(
    () => assertAssignedReviewer(REVIEWER_A, REVIEWER_B),
    (error) =>
      error?.code === "CONSULTATION_ASSIGNED_TO_OTHER_REVIEWER" &&
      error?.statusCode === 409
  );
});

test("AI assistance is restricted to non-finalised pre-decision sessions", () => {
  for (const status of [
    "draft",
    "in_progress",
    "more_information_required",
    "awaiting_review",
  ]) {
    assert.doesNotThrow(() => assertConsultationAssistable(status));
  }

  for (const status of [
    "in_person_required",
    "approved",
    "booking_ready",
    "booked",
    "closed",
    "archived",
  ]) {
    assert.throws(
      () => assertConsultationAssistable(status),
      (error) =>
        error?.code === "CONSULTATION_AI_SESSION_FINALISED" &&
        error?.statusCode === 409
    );
  }
});
