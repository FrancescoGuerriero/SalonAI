import assert from "node:assert/strict";
import test from "node:test";
import {
  aiWorkforceLocationMatch,
} from "../features/aiPlatform/aiWorkforceGovernanceService.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const ALLOWED = "507f1f77bcf86cd799439022";
const OTHER_ALLOWED = "507f1f77bcf86cd799439023";
const FOREIGN = "507f1f77bcf86cd799439029";

const selected = {
  businessId: BUSINESS,
  locationId: ALLOWED,
  locationAccessMode: "selected",
  allowedLocationIds: [ALLOWED, OTHER_ALLOWED],
};

test("selected-location AI Workforce reads remain limited to granted locations", () => {
  assert.deepEqual(
    aiWorkforceLocationMatch(selected),
    { location: { $in: [ALLOWED, OTHER_ALLOWED] } }
  );
  assert.deepEqual(aiWorkforceLocationMatch(selected, OTHER_ALLOWED), {
    location: OTHER_ALLOWED,
  });
  assert.throws(
    () => aiWorkforceLocationMatch(selected, FOREIGN),
    /not authorised/
  );
});

test("AI Workforce never interprets unknown or empty membership scope as all locations", () => {
  assert.deepEqual(
    aiWorkforceLocationMatch({
      businessId: BUSINESS,
      locationAccessMode: "selected",
      allowedLocationIds: [],
    }),
    { location: { $in: [] } }
  );
  assert.deepEqual(
    aiWorkforceLocationMatch({ businessId: BUSINESS, locationAccessMode: "unknown" }),
    { location: { $in: [] } }
  );
  assert.throws(() => aiWorkforceLocationMatch(null), /Trusted tenant authority/);
});

test("only explicit all-location membership may query the whole business", () => {
  const all = {
    businessId: BUSINESS,
    locationAccessMode: "all",
    allowedLocationIds: null,
  };
  assert.deepEqual(aiWorkforceLocationMatch(all), {});
  assert.deepEqual(aiWorkforceLocationMatch(all, FOREIGN), { location: FOREIGN });
  assert.throws(() => aiWorkforceLocationMatch(all, "invalid"), /valid identifier/);
});
