import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationMutationScope,
  buildConsultationReadScope,
  consultationObjectId,
} from "../features/consultations/consultationSessionAuthorityService.js";
import {
  assertConsultationTransition,
  consultationInferenceEnabled,
  sanitizeConsultationFeatures,
  sanitizeConsultationResponses,
} from "../features/consultations/consultationSessionService.js";

const BUSINESS = "64f000000000000000000001";
const LOCATION_A = "64f000000000000000000002";
const LOCATION_B = "64f000000000000000000003";
const CUSTOMER = "64f000000000000000000004";

function authority(overrides = {}) {
  return {
    businessId: BUSINESS,
    locationId: LOCATION_A,
    locationAccessMode: "selected",
    allowedLocationIds: [LOCATION_A],
    ...overrides,
  };
}

test("consultation read scope is derived only from trusted Business and allowed Locations", () => {
  const filter = buildConsultationReadScope(authority(), {});
  assert.equal(filter.business.toHexString(), BUSINESS);
  assert.deepEqual(
    filter.location.$in.map((value) => value.toHexString()),
    [LOCATION_A]
  );
});

test("consultation read scope fails closed for an unauthorised requested Location", () => {
  const filter = buildConsultationReadScope(authority(), {
    locationId: LOCATION_B,
  });
  assert.deepEqual(filter.location.$in, []);
});

test("all-location authority may read the active Business without a user-supplied scope", () => {
  const filter = buildConsultationReadScope(
    authority({
      locationId: null,
      locationAccessMode: "all",
      allowedLocationIds: null,
    }),
    { customerId: CUSTOMER }
  );
  assert.equal(filter.business.toHexString(), BUSINESS);
  assert.equal(filter.customer.toHexString(), CUSTOMER);
  assert.equal(Object.hasOwn(filter, "location"), false);
});

test("consultation mutation scope requires a trusted selected Location", () => {
  const filter = buildConsultationMutationScope(authority());
  assert.equal(filter.business.toHexString(), BUSINESS);
  assert.equal(filter.location.toHexString(), LOCATION_A);

  assert.throws(
    () =>
      buildConsultationMutationScope(
        authority({ locationId: null })
      ),
    (error) =>
      error?.code === "LOCATION_CONTEXT_REQUIRED" &&
      error?.statusCode === 403
  );
});

test("consultation identifiers reject operator-shaped and malformed values", () => {
  for (const value of [{ $ne: null }, [CUSTOMER], "not-an-object-id"]) {
    assert.throws(
      () => consultationObjectId(value, "customerId"),
      (error) =>
        error?.code === "INVALID_CONSULTATION_IDENTIFIER" &&
        error?.statusCode === 400
    );
  }
});

test("consultation filters reject object-shaped query parameters", () => {
  assert.throws(
    () => buildConsultationReadScope(authority(), { status: { $ne: "closed" } }),
    (error) => error?.code === "INVALID_CONSULTATION_FILTER"
  );
});

test("consultation lifecycle rejects review and booking shortcuts", () => {
  assert.equal(assertConsultationTransition("draft", "in_progress"), "in_progress");
  assert.equal(
    assertConsultationTransition("in_progress", "awaiting_review"),
    "awaiting_review"
  );
  assert.throws(
    () => assertConsultationTransition("in_progress", "approved"),
    (error) => error?.code === "INVALID_CONSULTATION_STATUS_TRANSITION"
  );
  assert.throws(
    () => assertConsultationTransition("awaiting_review", "booking_ready"),
    (error) => error?.code === "INVALID_CONSULTATION_STATUS_TRANSITION"
  );
});

test("consultation feature input is allowlisted and rejects nested payloads", () => {
  assert.deepEqual(
    sanitizeConsultationFeatures({
      desiredOutcome: "cool blonde",
      currentColour: "brown",
      ignoredField: "not persisted",
    }),
    {
      desiredOutcome: "cool blonde",
      currentColour: "brown",
    }
  );
  assert.throws(
    () => sanitizeConsultationFeatures({ desiredOutcome: { $ne: null } }),
    (error) => error?.code === "INVALID_CONSULTATION_INPUT"
  );
});

test("consultation responses are bounded scalar records", () => {
  const [response] = sanitizeConsultationResponses([
    { key: "currentColour", value: "brown", source: "staff" },
  ]);
  assert.equal(response.key, "currentColour");
  assert.equal(response.value, "brown");
  assert.equal(response.source, "staff");
  assert.ok(response.answeredAt instanceof Date);

  assert.throws(
    () => sanitizeConsultationResponses([{ key: "x", value: { $gt: "" } }]),
    (error) => error?.code === "INVALID_CONSULTATION_INPUT"
  );
});

test("consultation AI inference remains disabled unless explicitly enabled", () => {
  assert.equal(consultationInferenceEnabled({}), false);
  assert.equal(
    consultationInferenceEnabled({ CONSULTATION_AI_INFERENCE_ENABLED: "false" }),
    false
  );
  assert.equal(
    consultationInferenceEnabled({ CONSULTATION_AI_INFERENCE_ENABLED: "true" }),
    true
  );
});
