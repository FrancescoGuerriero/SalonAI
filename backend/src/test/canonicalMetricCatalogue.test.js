import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  APPOINTMENT_METRIC_KEYS,
  getMetricDefinition,
  listMetricDefinitions,
} from "../features/analytics/metricCatalogue.js";
import {
  buildCanonicalMetricPeriod,
  calculateAppointmentMetricComparison,
} from "../features/analytics/appointmentMetricCalculator.js";

function metricByKey(comparison, key) {
  return comparison.metrics.find(
    (metric) => metric.key === key
  );
}

test("canonical Appointment metric catalogue is versioned and stable", () => {
  assert.deepEqual(
    [...APPOINTMENT_METRIC_KEYS],
    [
      "bookings",
      "completed",
      "revenue",
      "no-show-rate",
      "cancellation-rate",
    ]
  );

  const definitions = listMetricDefinitions();
  assert.equal(definitions.length, 5);
  assert.equal(
    new Set(
      definitions.map((definition) => definition.key)
    ).size,
    5
  );

  for (const definition of definitions) {
    assert.equal(definition.version, "1.0.0");
    assert.equal(definition.domain, "appointments");
    assert.deepEqual(
      [...definition.requiredPermissions],
      ["appointment:read"]
    );
    assert.equal(Object.isFrozen(definition), true);
  }

  assert.equal(
    getMetricDefinition("revenue").aggregation,
    "sum"
  );
  assert.equal(
    getMetricDefinition("no-show-rate").denominatorKey,
    "bookings"
  );
});

test("canonical metric period uses deterministic inclusive UTC calendar-day boundaries", () => {
  const period = buildCanonicalMetricPeriod({
    periodDays: 7,
    asOfDate: "2026-10-18T12:34:56.000Z",
  });

  assert.equal(
    period.currentStart.toISOString(),
    "2026-10-12T00:00:00.000Z"
  );
  assert.equal(
    period.currentEnd.toISOString(),
    "2026-10-18T23:59:59.999Z"
  );
  assert.equal(
    period.previousStart.toISOString(),
    "2026-10-05T00:00:00.000Z"
  );
  assert.equal(
    period.previousEnd.toISOString(),
    "2026-10-11T23:59:59.999Z"
  );
  assert.equal(
    period.timeBasis,
    "UTC calendar days, inclusive"
  );
});

test("canonical calculator applies status policy, revenue policy, fallback occurrence and zero-safe rates", () => {
  const period = buildCanonicalMetricPeriod({
    periodDays: 7,
    asOfDate: "2026-10-18T12:00:00.000Z",
  });
  const comparison = calculateAppointmentMetricComparison({
    period,
    rows: [
      {
        status: "completed",
        startsAt: "2026-10-18T09:00:00.000Z",
        totalPrice: 120,
      },
      {
        status: "no_show",
        startsAt: "2026-10-17T09:00:00.000Z",
        totalPrice: 80,
      },
      {
        status: "cancelled",
        startsAt: "2026-10-16T09:00:00.000Z",
        totalPrice: 70,
      },
      {
        status: "pending",
        appointmentDate: "2026-10-12T00:00:00.000Z",
        totalPrice: 55,
      },
      {
        status: "completed",
        startsAt: "2026-10-11T23:59:59.999Z",
        total: 50,
      },
    ],
  });

  assert.equal(comparison.current.bookings, 4);
  assert.equal(comparison.current.completed, 1);
  assert.equal(comparison.current.revenue, 120);
  assert.equal(comparison.previous.bookings, 1);
  assert.equal(comparison.previous.revenue, 50);

  assert.equal(metricByKey(comparison, "bookings").value, 4);
  assert.equal(metricByKey(comparison, "completed").value, 1);
  assert.equal(metricByKey(comparison, "revenue").value, 120);
  assert.equal(metricByKey(comparison, "no-show-rate").value, 25);
  assert.equal(metricByKey(comparison, "cancellation-rate").value, 25);
  assert.equal(
    metricByKey(comparison, "revenue").previous_value,
    50
  );
  assert.equal(
    metricByKey(comparison, "no-show-rate").previous_value,
    0
  );
  assert.equal(
    metricByKey(comparison, "revenue").version,
    "1.0.0"
  );
  assert.equal(
    metricByKey(comparison, "revenue").evidence.sourceModel,
    "Appointment"
  );

  const empty = calculateAppointmentMetricComparison({
    period,
    rows: [],
  });
  assert.equal(metricByKey(empty, "no-show-rate").value, 0);
  assert.equal(metricByKey(empty, "cancellation-rate").value, 0);
});

test("Management Copilot consumes the catalogue and Adviser retains metric key/version evidence", async () => {
  const copilot = await readFile(
    new URL(
      "../features/aiRecommendations/aiManagementCopilotService.js",
      import.meta.url
    ),
    "utf8"
  );
  const adviser = await readFile(
    new URL(
      "../features/aiRecommendations/aiAdviserService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    copilot,
    /calculateAppointmentMetricComparison/
  );
  assert.match(
    copilot,
    /metricDefinitions:[\s\S]*?key:[\s\S]*?metric\.key[\s\S]*?version:[\s\S]*?metric\.version/
  );
  assert.match(
    copilot,
    /toAiManagementCopilotRequest/
  );
  assert.match(
    adviser,
    /key:\s*metric\.key,[\s\S]*?version:[\s\S]*?metric\.version/
  );
  assert.match(
    adviser,
    /timeBasis/
  );
});
