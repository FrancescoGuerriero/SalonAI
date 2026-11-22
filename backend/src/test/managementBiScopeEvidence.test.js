import assert from "node:assert/strict";
import test from "node:test";
import { buildManagementBiSnapshot } from "../features/analytics/managementBiService.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439022";
const L1 = "507f1f77bcf86cd799439023";
const L2 = "507f1f77bcf86cd799439024";
const L3 = "507f1f77bcf86cd799439025";
const AS_OF = "2026-11-22";

function fixture(locations = [], appointments = []) {
  const queries = { locations: [], appointments: [], appointmentProjection: "" };
  const locationModel = {
    find(query) {
      queries.locations.push(query);
      return {
        select(projection) {
          queries.locationProjection = projection;
          return { lean: async () => locations };
        },
      };
    },
  };
  const appointmentModel = {
    find(query) {
      queries.appointments.push(query);
      return {
        select(projection) {
          queries.appointmentProjection = projection;
          return { lean: async () => appointments };
        },
      };
    },
  };
  return { queries, locationModel, appointmentModel };
}

async function snapshot(effectiveAuthority, mock) {
  return buildManagementBiSnapshot({
    effectiveAuthority, periodDays: 7, asOfDate: AS_OF,
  }, mock);
}

test("Module 16 BI checks tenant-owned locations and returned appointment facts before canonical aggregation", async () => {
  const mock = fixture([
    { _id: L2, business: BUSINESS, status: "active" },
    { _id: L1, business: BUSINESS, status: "inactive" },
  ], [
    { business: BUSINESS, location: L1, startsAt: "2026-11-20T10:00:00Z",
      status: "completed", totalPrice: 45 },
    { business: BUSINESS, location: L2, startsAt: "2026-11-13T10:00:00Z",
      status: "no-show", totalPrice: 20 },
  ]);
  const result = await snapshot({
    businessId: BUSINESS, locationAccessMode: "all", locationId: L1,
  }, mock);
  assert.deepEqual(result.authority.locationIds, [L1, L2]);
  assert.equal(result.authority.locationOwnedFactsOnly, true);
  assert.equal(result.authority.ambiguousLegacyLocationExcluded, true);
  assert.equal(result.evidence.recordsMatched, 2);
  assert.equal(result.evidence.containsCustomerPii, false);
  assert.equal(result.executionAuthorised, false);
  assert.equal(result.externalWriteAuthorised, false);
  assert.equal(result.pythonAnalysis.available, false);
  assert.equal(mock.queries.locations[0].business, BUSINESS);
  assert.deepEqual(mock.queries.locations[0].status, { $ne: "archived" });
  assert.ok(mock.queries.locationProjection.includes("business"));
  assert.deepEqual(mock.queries.appointments[0].location.$in, [L1, L2]);
  assert.equal(mock.queries.appointments[0].business, BUSINESS);
  assert.ok(mock.queries.appointmentProjection.split(" ").includes("business"));
  assert.ok(mock.queries.appointmentProjection.split(" ").includes("location"));
  assert.equal(result.metrics.find((metric) => metric.key === "bookings").value, 1);
  assert.equal(result.metrics.find((metric) => metric.key === "completed").value, 1);
});

test("BI evidence remains deterministic when valid business locations arrive out of order", async () => {
  const locs = [
    { _id: L1, business: BUSINESS, status: "active" },
    { _id: L2, business: BUSINESS, status: "active" },
  ];
  const facts = [{ business: BUSINESS, location: L1,
    startsAt: "2026-11-20T10:00:00Z", status: "completed", totalPrice: 80 }];
  const authority = { businessId: BUSINESS, locationAccessMode: "all" };
  const left = await snapshot(authority, fixture(locs, facts));
  const right = await snapshot(authority, fixture([...locs].reverse(), facts));
  assert.equal(left.evidence.checksum, right.evidence.checksum);
  assert.equal(left.evidence.evidenceId, right.evidence.evidenceId);
  assert.deepEqual(left.authority.locationIds, right.authority.locationIds);
});

test("BI fails closed on foreign, missing, archived, duplicate or malformed location evidence", async () => {
  const base = { _id: L1, business: BUSINESS, status: "active" };
  for (const locations of [
    [{ ...base, business: FOREIGN }],
    [{ _id: L1, status: "active" }],
    [{ ...base, status: "archived" }],
    [{ ...base, status: null }],
    [base, base],
    [{ ...base, _id: "not-object-id" }],
    null,
  ]) {
    const mock = fixture(locations, []);
    await assert.rejects(
      snapshot({ businessId: BUSINESS, locationAccessMode: "all" }, mock),
      (err) => err.code === "POINT10_LOCATION_EVIDENCE_INVALID" && err.statusCode === 502,
    );
    assert.equal(mock.queries.appointments.length, 0);
  }
});

test("selected all-scope location absent from the verified location set is rejected", async () => {
  const mock = fixture([{ _id: L1, business: BUSINESS, status: "active" }]);
  await assert.rejects(
    snapshot({ businessId: BUSINESS, locationAccessMode: "all", locationId: L3 }, mock),
    (err) => err.code === "POINT10_LOCATION_AUTHORITY_REQUIRED" && err.statusCode === 403,
  );
  assert.equal(mock.queries.appointments.length, 0);
});

test("selected-location scope remains bounded and rejects invalid authorised IDs", async () => {
  const mock = fixture([], [{
    business: BUSINESS, location: L1,
    startsAt: "2026-11-21T12:00:00Z", status: "completed", totalPrice: 15,
  }]);
  const authority = {
    businessId: BUSINESS, locationAccessMode: "selected",
    locationId: L1, allowedLocationIds: [L2, L1],
  };
  const result = await snapshot(authority, mock);
  assert.deepEqual(result.authority.locationIds, [L1, L2]);
  assert.equal(mock.queries.locations.length, 0);
  assert.equal(result.evidence.recordsMatched, 1);
  assert.equal(result.pythonAnalysis.available, false);

  for (const invalid of [
    { ...authority, locationAccessMode: "unexpected" },
    { ...authority, allowedLocationIds: ["invalid-location"] },
    { ...authority, locationId: "invalid-location" },
  ]) {
    const f = fixture();
    await assert.rejects(snapshot(invalid, f),
      (err) => err.code === "POINT10_LOCATION_AUTHORITY_REQUIRED" ||
        err.code === "POINT10_INVALID_ID");
    assert.equal(f.queries.appointments.length, 0);
  }
});

test("BI rejects returned foreign, unlocated and unauthorised appointment evidence", async () => {
  const valid = {
    business: BUSINESS, location: L1, startsAt: "2026-11-20T12:00:00Z",
    status: "completed", totalPrice: 55,
  };
  for (const rows of [
    [{ ...valid, business: FOREIGN }],
    [{ ...valid, business: undefined }],
    [{ ...valid, location: L2 }],
    [{ ...valid, location: null }],
    [null],
    null,
  ]) {
    const mock = fixture([], rows);
    await assert.rejects(snapshot({
      businessId: BUSINESS, locationAccessMode: "selected",
      locationId: L1, allowedLocationIds: [L1],
    }, mock), (err) =>
      err.code === "POINT10_APPOINTMENT_EVIDENCE_INVALID" &&
      err.statusCode === 502);
    assert.equal(mock.queries.appointments.length, 1);
  }
});
