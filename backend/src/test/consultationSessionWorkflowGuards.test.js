import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertGenericConsultationUpdate,
} from "../features/consultations/consultationSessionController.js";
import {
  assertConsultationEditable,
} from "../features/consultations/consultationSessionService.js";

const appSource = await readFile(
  new URL("../app.js", import.meta.url),
  "utf8"
);

test("consultation API is mounted at the canonical application path", () => {
  assert.match(
    appSource,
    /import consultationSessionRoutes from "\.\/features\/consultations\/consultationSessionRoutes\.js";/
  );
  assert.match(
    appSource,
    /app\.use\(\s*"\/api\/consultations",\s*consultationSessionRoutes\s*\);/
  );
});

test("generic consultation update cannot impersonate review or booking workflows", () => {
  for (const status of [
    "approved",
    "booking_ready",
    "booked",
    "closed",
    "more_information_required",
    "in_person_required",
  ]) {
    assert.throws(
      () => assertGenericConsultationUpdate({ status }),
      (error) =>
        error?.code === "CONSULTATION_STATUS_REQUIRES_DEDICATED_WORKFLOW" &&
        error?.statusCode === 409
    );
  }

  assert.doesNotThrow(() =>
    assertGenericConsultationUpdate({ status: "awaiting_review" })
  );
});

test("generic edits are rejected after human review or booking progression", () => {
  for (const status of [
    "awaiting_review",
    "in_person_required",
    "approved",
    "booking_ready",
    "booked",
    "closed",
    "archived",
  ]) {
    assert.throws(
      () => assertConsultationEditable(status),
      (error) =>
        error?.code === "CONSULTATION_REVIEW_REQUIRED_FOR_EDIT" &&
        error?.statusCode === 409
    );
  }

  for (const status of ["draft", "in_progress", "more_information_required"]) {
    assert.doesNotThrow(() => assertConsultationEditable(status));
  }
});
