import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  APPOINTMENT_METRIC_KEYS,
  CANONICAL_METRIC_KEYS,
  OPERATIONAL_METRIC_KEYS,
  getMetricDefinition,
  listMetricDefinitions,
} from "../features/analytics/metricCatalogue.js";
import {
  buildCanonicalMetricPeriod,
  calculateAppointmentMetricComparison,
} from "../features/analytics/appointmentMetricCalculator.js";
import {
  calculateCanonicalRatio,
  canonicalRatioResult,
} from "../features/analytics/operationalMetricCalculator.js";

function metricByKey(comparison, key) {
  return comparison.metrics.find((metric) => metric.key === key);
}

test("canonical metric catalogue v2 covers appointment and operational KPI contracts", () => {
  assert.deepEqual([...APPOINTMENT_METRIC_KEYS], [
    "bookings",
    "completed",
    "revenue",
    "no-show-rate",
    "cancellation-rate",
  ]);
  assert.deepEqual([...OPERATIONAL_METRIC_KEYS], [
    "rebook-rate",
    "retention-rate",
    "utilisation-rate",
    "conversion-rate",
  ]);
  assert.equal(CANONICAL_METRIC_KEYS.length, 9);

  const definitions = listMetricDefinitions();
  assert.equal(definitions.length, 9);
  assert.equal(new Set(definitions.map((definition) => definition.key)).size, 9);

  for (const definition of definitions) {
    assert.equal(definition.version, "2.0.0");
    assert.equal(Object.isFrozen(definition), true);
    assert.ok(definition.evidence.sourceModel);
  }

  assert.equal(getMetricDefinition("revenue").aggregation, "sum");
  assert.equal(getMetricDefinition("no-show-rate").denominatorKey, "bookings");
  assert.equal(
    getMetricDefinition("utilisation-rate").formula,
    "booked_service_minutes / available_staff_minutes * 100"
  );
  assert.equal(
    getMetricDefinition("retention-rate").formula,
    "returning_active_customers / active_customers * 100"
  );
});

test("canonical ratio calculator is deterministic, zero-safe and definition-governed", () => {
  assert.equal(
    calculateCanonicalRatio("utilisation-rate", 75, 100),
    75
  );
  assert.equal(
    calculateCanonicalRatio("conversion-rate", 1, 3),
    33.3
  );
  assert.equal(
    calculateCanonicalRatio("retention-rate", 10, 0),
    0
  );
  assert.equal(
    calculateCanonicalRatio("rebook-rate", -1, 10),
    0
  );

  const result = canonicalRatioResult(
    "conversion-rate",
    4,
    8
  );
  assert.equal(result.value, 50);
  assert.equal(result.version, "2.0.0");
  assert.equal(result.evidence.formula, "successful_conversions / eligible_opportunities * 100");

  assert.throws(
    () => calculateCanonicalRatio("revenue", 1, 2),
    (error) => error.code === "METRIC_NOT_RATIO"
  );
});

test("canonical metric period uses deterministic inclusive UTC calendar-day boundaries", () => {
  const period = buildCanonicalMetricPeriod({
    periodDays: 7,
    asOfDate: "2026-10-18T12:34:56.000Z",
  });

  assert.equal(period.currentStart.toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(period.currentEnd.toISOString(), "2026-10-18T23:59:59.999Z");
  assert.equal(period.previousStart.toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(period.previousEnd.toISOString(), "2026-10-11T23:59:59.999Z");
  assert.equal(period.timeBasis, "UTC calendar days, inclusive");
});

test("appointment calculator remains backwards compatible under catalogue v2", () => {
  const period = buildCanonicalMetricPeriod({
    periodDays: 7,
    asOfDate: "2026-10-18T12:00:00.000Z",
  });
  const comparison = calculateAppointmentMetricComparison({
    period,
    rows: [
      { status: "completed", startsAt: "2026-10-18T09:00:00.000Z", totalPrice: 120 },
      { status: "no_show", startsAt: "2026-10-17T09:00:00.000Z", totalPrice: 80 },
      { status: "cancelled", startsAt: "2026-10-16T09:00:00.000Z", totalPrice: 70 },
      { status: "pending", appointmentDate: "2026-10-12T00:00:00.000Z", totalPrice: 55 },
      { status: "completed", startsAt: "2026-10-11T23:59:59.999Z", total: 50 },
    ],
  });

  assert.equal(comparison.current.bookings, 4);
  assert.equal(comparison.current.completed, 1);
  assert.equal(comparison.current.revenue, 120);
  assert.equal(metricByKey(comparison, "no-show-rate").value, 25);
  assert.equal(metricByKey(comparison, "cancellation-rate").value, 25);
  assert.equal(metricByKey(comparison, "revenue").version, "2.0.0");
  assert.equal(metricByKey(comparison, "revenue").evidence.sourceModel, "Appointment");
});

test("capacity planning and marketing attribution consume canonical operational formulas", async () => {
  const [capacity, marketing] = await Promise.all([
    readFile(
      new URL("../features/capacityPlanning/capacityPlanningService.js", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../features/marketingAttribution/marketingAttributionService.js", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(capacity, /calculateCanonicalRatio\([\s\S]*?"utilisation-rate"/);
  assert.match(capacity, /canonicalMetricEvidence\("utilisation-rate"\)/);
  assert.doesNotMatch(capacity, /bookedHours \/ availableHoursPerStaff\) \* 100/);

  assert.match(marketing, /calculateCanonicalRatio\([\s\S]*?"conversion-rate"/);
  assert.match(marketing, /canonicalMetricEvidence\("conversion-rate"\)/);
  assert.doesNotMatch(marketing, /completedAppointments \/ attributedAppointments\) \* 100/);
});

test("Management Copilot retains canonical metric key/version evidence for AI", async () => {
  const copilot = await readFile(
    new URL(
      "../features/aiRecommendations/aiManagementCopilotService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(copilot, /calculateAppointmentMetricComparison/);
  assert.match(
    copilot,
    /metricDefinitions:[\s\S]*?key:[\s\S]*?metric\.key[\s\S]*?version:[\s\S]*?metric\.version/
  );
});
