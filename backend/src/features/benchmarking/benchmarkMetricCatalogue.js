export const BENCHMARK_METRIC_CATALOGUE_VERSION = "1";

export const BENCHMARK_METRICS = Object.freeze({
  "appointment.completion_rate_pct": Object.freeze({
    key: "appointment.completion_rate_pct",
    label: "Appointment completion rate",
    unit: "percent",
    minimum: 0,
    maximum: 100,
    decimals: 1,
  }),
  "appointment.no_show_rate_pct": Object.freeze({
    key: "appointment.no_show_rate_pct",
    label: "Appointment no-show rate",
    unit: "percent",
    minimum: 0,
    maximum: 100,
    decimals: 1,
  }),
  "appointment.cancellation_rate_pct": Object.freeze({
    key: "appointment.cancellation_rate_pct",
    label: "Appointment cancellation rate",
    unit: "percent",
    minimum: 0,
    maximum: 100,
    decimals: 1,
  }),
  "appointment.average_completed_value": Object.freeze({
    key: "appointment.average_completed_value",
    label: "Average completed appointment value",
    unit: "currency",
    minimum: 0,
    maximum: 5000,
    decimals: 2,
  }),
});

export const BENCHMARK_METRIC_KEYS = Object.freeze(
  Object.keys(BENCHMARK_METRICS)
);

export const BENCHMARK_PRIVACY_POLICY = Object.freeze({
  version: "1",
  minimumTenantSample: 10,
  minimumCohortTenants: 10,
  maximumLookbackMonths: 12,
  cohortDimensions: Object.freeze(["vertical", "currency"]),
  individualTenantMetricsExposedCrossTenant: false,
  rawOperationalRowsStored: false,
  rawCustomerDataStored: false,
  rawEmployeeDataStored: false,
  clinicalDataStored: false,
  communicationContentStored: false,
  exactExtremaPublished: false,
  differentialPrivacyApplied: false,
  disclosureControls: Object.freeze([
    "explicit-participation",
    "minimum-tenant-sample",
    "minimum-cohort-size",
    "bounded-metrics",
    "rounded-statistics",
    "quartiles-without-extrema",
    "broad-cohort-dimensions",
  ]),
});

export function benchmarkMetricDefinition(key) {
  return BENCHMARK_METRICS[String(key || "").trim().toLowerCase()] || null;
}

export function normaliseBenchmarkMetricKeys(value) {
  const requested = [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const keys = requested.length > 0 ? requested : [...BENCHMARK_METRIC_KEYS];
  const invalid = keys.filter((key) => !benchmarkMetricDefinition(key));
  if (invalid.length > 0) {
    const error = new Error(`Unsupported benchmark metric: ${invalid.join(", ")}.`);
    error.code = "BENCHMARK_METRIC_NOT_ALLOWED";
    error.statusCode = 400;
    throw error;
  }
  return Object.freeze(keys);
}

export default Object.freeze({
  BENCHMARK_METRIC_CATALOGUE_VERSION,
  BENCHMARK_METRIC_KEYS,
  BENCHMARK_METRICS,
  BENCHMARK_PRIVACY_POLICY,
  benchmarkMetricDefinition,
  normaliseBenchmarkMetricKeys,
});
