import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemandTrainingRows,
  evaluateDemandDatasetReadiness,
} from "../features/aiPlatform/demandTrainingDatasetService.js";
import {
  buildDemandAiCoreManifest,
} from "../features/aiPlatform/demandAiCoreManifestService.js";

const BUSINESS_ID = "507f1f77bcf86cd799439011";
const LOCATION_ID = "507f1f77bcf86cd799439012";

function appointment(id, date, status = "completed") {
  return {
    _id: id,
    appointmentDate: new Date(`${date}T12:00:00.000Z`),
    startsAt: new Date(`${date}T12:00:00.000Z`),
    status,
  };
}

function dataset(overrides = {}) {
  return {
    name: "salonai-demand-forecast",
    version: "demand-dataset-v2",
    task: "demand_forecasting",
    featureVersion: "demand-forecast-v2",
    status: "frozen",
    snapshotCount: 84,
    dataHash: "b".repeat(64),
    scope: {
      mode: "single_business",
      business: BUSINESS_ID,
      locations: [LOCATION_ID],
    },
    lineage: {
      sourceCollections: ["appointments"],
    },
    updatedAt: new Date("2026-10-28T01:00:00Z"),
    ...overrides,
  };
}

test("demand dataset keeps zero-booking calendar days in the daily series", () => {
  const rows = buildDemandTrainingRows([
    appointment("a1", "2026-01-01"),
    appointment("a2", "2026-01-03", "cancelled"),
  ]);

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => [row.entityKey, row.label]),
    [
      ["2026-01-01", 1],
      ["2026-01-02", 0],
      ["2026-01-03", 1],
    ]
  );
  assert.equal(rows[1].metadata.calendarContinuity, true);
  assert.equal(rows[1].sourceRefs.length, 0);
});

test("demand v2 distinguishes missing workforce evidence from known zero capacity", () => {
  const rows = buildDemandTrainingRows(
    [
      appointment("a1", "2026-01-01"),
      appointment("a2", "2026-01-03"),
    ],
    [
      {
        _id: "507f1f77bcf86cd799439099",
        businessDate: new Date("2026-01-02T00:00:00.000Z"),
        availableStaffHours: 0,
        appointmentCapacity: 0,
        sourceType: "manual_roster",
      },
    ]
  );

  assert.equal(rows[0].features.available_staff_hours, 0);
  assert.equal(rows[0].features.workforce_capacity_observed, 0);
  assert.equal(rows[0].metadata.workforceCapacityJoined, false);

  assert.equal(rows[1].features.available_staff_hours, 0);
  assert.equal(rows[1].features.workforce_capacity_observed, 1);
  assert.equal(rows[1].metadata.workforceCapacityJoined, true);
  assert.equal(
    rows[1].metadata.workforceCapacitySourceType,
    "manual_roster"
  );

  assert.equal(rows[2].features.workforce_capacity_observed, 0);
});

test("same-day appointment outcomes are diagnostics and never model features", () => {
  const rows = buildDemandTrainingRows([
    appointment("a1", "2026-01-01", "completed"),
    appointment("a2", "2026-01-01", "cancelled"),
    appointment("a3", "2026-01-01", "no_show"),
  ]);

  const row = rows[0];
  assert.deepEqual(Object.keys(row.features).sort(), [
    "appointment_capacity",
    "available_staff_hours",
    "workforce_capacity_observed",
  ]);
  assert.deepEqual(row.metadata.outcomeDiagnostics, {
    completedAppointments: 1,
    cancelledAppointments: 1,
    noShowAppointments: 1,
  });
  assert.equal(row.label, 3);
});

test("demand dataset readiness reports workforce capacity coverage from observed flag", () => {
  const rows = Array.from({ length: 42 }, (_, index) => ({
    split:
      index < 29
        ? "train"
        : index < 35
          ? "validation"
          : "test",
    label: index % 3,
    features: {
      available_staff_hours: index < 21 ? 8 : 0,
      appointment_capacity: 0,
      workforce_capacity_observed: index < 21 ? 1 : 0,
    },
    metadata: {},
  }));

  const result = evaluateDemandDatasetReadiness(rows);

  assert.equal(result.readyToFreeze, true);
  assert.equal(result.capacityRows, 21);
  assert.equal(result.capacityCoverage, 0.5);
  assert.ok(
    result.warnings.some((item) => item.includes("observed-capacity"))
  );
});

test("demand dataset readiness requires at least 42 continuous days", () => {
  const shortRows = Array.from({ length: 41 }, (_, index) => ({
    split:
      index < 28
        ? "train"
        : index < 35
          ? "validation"
          : "test",
    label: index % 2,
    features: {
      available_staff_hours: 0,
      appointment_capacity: 0,
      workforce_capacity_observed: 0,
    },
    metadata: {},
  }));

  const result = evaluateDemandDatasetReadiness(shortRows);

  assert.equal(result.readyToFreeze, false);
  assert.ok(
    result.blockers.some((item) => item.includes("42"))
  );
});

test("AI Core demand manifest is issued only for one frozen Business/Location v2 dataset", () => {
  const manifest = buildDemandAiCoreManifest(dataset());

  assert.equal(
    manifest.contract,
    "aiibp_training_dataset_manifest_v1"
  );
  assert.equal(manifest.dataset_key, "appointments-history");
  assert.equal(manifest.business_id, BUSINESS_ID);
  assert.equal(manifest.location_id, LOCATION_ID);
  assert.equal(manifest.approved_purpose, "demand_forecasting");
  assert.equal(
    manifest.feature_definition_version,
    "demand-forecast-v2"
  );
  assert.equal(manifest.row_count, 84);
  assert.equal(manifest.sha256_fingerprint, "b".repeat(64));
  assert.equal(manifest.contains_direct_identifiers, false);
  assert.equal(manifest.contains_credentials, false);
});

test("AI Core demand manifest rejects old feature contracts, multi-location and malformed fingerprints", () => {
  assert.throws(
    () =>
      buildDemandAiCoreManifest(
        dataset({ featureVersion: "demand-forecast-v1" })
      ),
    (error) =>
      error.code === "AI_TRAINING_DATASET_CONTRACT_MISMATCH"
  );

  assert.throws(
    () =>
      buildDemandAiCoreManifest(
        dataset({
          scope: {
            mode: "single_business",
            business: BUSINESS_ID,
            locations: [
              LOCATION_ID,
              "507f1f77bcf86cd799439013",
            ],
          },
        })
      ),
    (error) =>
      error.code ===
      "AI_TRAINING_DATASET_LOCATION_SCOPE_REQUIRED"
  );

  assert.throws(
    () =>
      buildDemandAiCoreManifest(
        dataset({ dataHash: "not-a-sha256" })
      ),
    (error) =>
      error.code ===
      "AI_TRAINING_DATASET_FINGERPRINT_REQUIRED"
  );
});
