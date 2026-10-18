import {
  APPOINTMENT_METRIC_KEYS,
  getMetricDefinition,
  metricDefinitionEvidence,
} from "./metricCatalogue.js";

const NO_SHOW_STATUSES = Object.freeze([
  "no-show",
  "no_show",
  "noshow",
]);
const CANCELLATION_STATUSES = Object.freeze([
  "cancelled",
  "canceled",
]);

export const APPOINTMENT_METRIC_PROJECTION =
  "status appointmentStatus totalPrice total amount price service startsAt appointmentDate";

function status(value = {}) {
  return String(
    value.status ||
      value.appointmentStatus ||
      ""
  )
    .trim()
    .toLowerCase();
}

function money(value = {}) {
  return Math.max(
    0,
    Number(
      value.totalPrice ??
        value.total ??
        value.amount ??
        value.price ??
        value.service?.price ??
        0
    ) || 0
  );
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime())
    ? null
    : candidate;
}

export function appointmentOccurrence(item = {}) {
  return (
    validDate(item.startsAt) ||
    validDate(item.appointmentDate)
  );
}

export function buildCanonicalMetricPeriod({
  periodDays = 30,
  asOfDate = new Date(),
} = {}) {
  const days = Math.max(
    1,
    Math.min(3650, Number(periodDays) || 30)
  );
  const parsedAsOf = validDate(asOfDate);

  if (!parsedAsOf) {
    const error = new Error(
      "A valid as-of date is required for canonical metric calculation."
    );
    error.code = "INVALID_METRIC_AS_OF_DATE";
    error.statusCode = 400;
    throw error;
  }

  const end = new Date(parsedAsOf);
  end.setUTCHours(23, 59, 59, 999);

  const currentStart = new Date(end);
  currentStart.setUTCDate(
    currentStart.getUTCDate() - days + 1
  );
  currentStart.setUTCHours(0, 0, 0, 0);

  const previousEnd = new Date(currentStart);
  previousEnd.setUTCMilliseconds(-1);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(
    previousStart.getUTCDate() - days + 1
  );
  previousStart.setUTCHours(0, 0, 0, 0);

  return Object.freeze({
    days,
    asOfDate: end.toISOString().slice(0, 10),
    periodLabel: `Last ${days} days`,
    timeBasis: "UTC calendar days, inclusive",
    currentStart,
    currentEnd: end,
    previousStart,
    previousEnd,
  });
}

function rowsInWindow(rows, start, end) {
  return (Array.isArray(rows) ? rows : []).filter(
    (item) => {
      const occurrence = appointmentOccurrence(item);
      return (
        occurrence &&
        occurrence >= start &&
        occurrence <= end
      );
    }
  );
}

export function summariseAppointmentMetricWindow(
  rows,
  start,
  end
) {
  const selected = rowsInWindow(rows, start, end);
  const completed = selected.filter(
    (item) => status(item) === "completed"
  );
  const noShows = selected.filter((item) =>
    NO_SHOW_STATUSES.includes(status(item))
  );
  const cancelled = selected.filter((item) =>
    CANCELLATION_STATUSES.includes(status(item))
  );

  return Object.freeze({
    bookings: selected.length,
    completed: completed.length,
    noShows: noShows.length,
    cancelled: cancelled.length,
    revenue: completed.reduce(
      (total, item) => total + money(item),
      0
    ),
  });
}

function ratioPercent(numerator, denominator) {
  return denominator
    ? (numerator / denominator) * 100
    : 0;
}

function valueForMetric(key, summary) {
  switch (key) {
    case "bookings":
      return summary.bookings;
    case "completed":
      return summary.completed;
    case "revenue":
      return summary.revenue;
    case "no-show-rate":
      return ratioPercent(
        summary.noShows,
        summary.bookings
      );
    case "cancellation-rate":
      return ratioPercent(
        summary.cancelled,
        summary.bookings
      );
    default:
      return 0;
  }
}

function metricResult(key, current, previous) {
  const definition = getMetricDefinition(key);

  return Object.freeze({
    key: definition.key,
    version: definition.version,
    label: definition.label,
    value: valueForMetric(key, current),
    previous_value: valueForMetric(key, previous),
    unit: definition.unit,
    area: definition.presentationArea,
    evidence: metricDefinitionEvidence(key),
  });
}

export function calculateAppointmentMetricComparison({
  rows = [],
  period,
} = {}) {
  if (!period?.currentStart || !period?.currentEnd) {
    const error = new Error(
      "A canonical metric period is required."
    );
    error.code = "METRIC_PERIOD_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  const current = summariseAppointmentMetricWindow(
    rows,
    period.currentStart,
    period.currentEnd
  );
  const previous = summariseAppointmentMetricWindow(
    rows,
    period.previousStart,
    period.previousEnd
  );

  return Object.freeze({
    current,
    previous,
    metrics: Object.freeze(
      APPOINTMENT_METRIC_KEYS.map((key) =>
        metricResult(key, current, previous)
      )
    ),
  });
}

export default {
  APPOINTMENT_METRIC_PROJECTION,
  appointmentOccurrence,
  buildCanonicalMetricPeriod,
  calculateAppointmentMetricComparison,
  summariseAppointmentMetricWindow,
};
