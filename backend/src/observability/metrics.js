import { monitorEventLoopDelay } from "node:perf_hooks";

const METRICS_CONTENT_TYPE =
  "text/plain; version=0.0.4; charset=utf-8";

const HTTP_DURATION_BUCKETS_SECONDS = Object.freeze([
  0.005,
  0.01,
  0.025,
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
  10,
]);

const httpRequestSeries = new Map();

const processStartedAtSeconds = Math.floor(
  Date.now() / 1000
);

const eventLoopDelay = monitorEventLoopDelay({
  resolution: 20,
});

eventLoopDelay.enable();

let activeHttpRequests = 0;
let abortedHttpRequests = 0;

function sanitiseMetricLabel(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function formatMetricLabels(labels) {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  const encoded = entries
    .map(
      ([name, value]) =>
        `${name}="${sanitiseMetricLabel(value)}"`
    )
    .join(",");

  return `{${encoded}}`;
}

function normaliseMethod(method) {
  const candidate = String(method || "UNKNOWN")
    .trim()
    .toUpperCase();

  return candidate || "UNKNOWN";
}

function normalisePathSegment(segment) {
  if (!segment) {
    return segment;
  }

  if (/^[a-f0-9]{24}$/i.test(segment)) {
    return ":objectId";
  }

  if (
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      segment
    )
  ) {
    return ":uuid";
  }

  if (/^\d+$/.test(segment)) {
    return ":id";
  }

  if (
    segment.length >= 32 &&
    /^[A-Za-z0-9._~-]+$/.test(segment)
  ) {
    return ":token";
  }

  return segment;
}

export function normaliseMetricPath(pathname) {
  let candidate = String(pathname || "/")
    .split("?")[0]
    .trim();

  if (!candidate.startsWith("/")) {
    candidate = `/${candidate}`;
  }

  const normalised = candidate
    .split("/")
    .map(normalisePathSegment)
    .join("/")
    .replace(/\/{2,}/g, "/");

  if (normalised.length > 160) {
    return `${normalised.slice(0, 157)}...`;
  }

  return normalised || "/";
}

function getStatusClass(statusCode) {
  const value = Number(statusCode);

  if (
    !Number.isInteger(value) ||
    value < 100 ||
    value > 599
  ) {
    return "unknown";
  }

  return `${Math.floor(value / 100)}xx`;
}

function getSeriesKey(labels) {
  return [
    labels.method,
    labels.path,
    labels.status_class,
  ].join("|");
}

function createSeries(labels) {
  return {
    labels,
    requestCount: 0,
    durationCount: 0,
    durationSumSeconds: 0,
    durationBuckets:
      HTTP_DURATION_BUCKETS_SECONDS.map(() => 0),
  };
}

function getOrCreateSeries(labels) {
  const key = getSeriesKey(labels);

  let series = httpRequestSeries.get(key);

  if (!series) {
    series = createSeries(labels);
    httpRequestSeries.set(key, series);
  }

  return series;
}

function observeDuration(series, durationSeconds) {
  series.durationCount += 1;
  series.durationSumSeconds += durationSeconds;

  for (
    let index = 0;
    index < HTTP_DURATION_BUCKETS_SECONDS.length;
    index += 1
  ) {
    if (
      durationSeconds <=
      HTTP_DURATION_BUCKETS_SECONDS[index]
    ) {
      series.durationBuckets[index] += 1;
    }
  }
}

export function startHttpRequestMetric({
  method,
  pathname,
}) {
  activeHttpRequests += 1;

  let completed = false;

  const baseLabels = {
    method: normaliseMethod(method),
    path: normaliseMetricPath(pathname),
  };

  return function finishHttpRequestMetric({
    statusCode,
    durationMs,
    aborted = false,
  }) {
    if (completed) {
      return;
    }

    completed = true;

    activeHttpRequests = Math.max(
      0,
      activeHttpRequests - 1
    );

    if (aborted) {
      abortedHttpRequests += 1;
    }

    const effectiveStatusCode = aborted
      ? 499
      : Number(statusCode) || 0;

    const labels = {
      ...baseLabels,
      status_class: getStatusClass(
        effectiveStatusCode
      ),
    };

    const durationSeconds =
      Math.max(0, Number(durationMs) || 0) /
      1000;

    const series = getOrCreateSeries(labels);

    series.requestCount += 1;

    observeDuration(series, durationSeconds);
  };
}

function addHelpAndType(
  lines,
  name,
  help,
  type
) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);
}

function renderHttpMetrics(lines) {
  addHelpAndType(
    lines,
    "salonai_http_requests_total",
    "Total number of completed HTTP requests.",
    "counter"
  );

  const sortedSeries = [
    ...httpRequestSeries.values(),
  ].sort((left, right) =>
    getSeriesKey(left.labels).localeCompare(
      getSeriesKey(right.labels)
    )
  );

  for (const series of sortedSeries) {
    lines.push(
      [
        "salonai_http_requests_total",
        formatMetricLabels(series.labels),
        " ",
        series.requestCount,
      ].join("")
    );
  }

  addHelpAndType(
    lines,
    "salonai_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    "histogram"
  );

  for (const series of sortedSeries) {
    for (
      let index = 0;
      index <
      HTTP_DURATION_BUCKETS_SECONDS.length;
      index += 1
    ) {
      const upperBound =
        HTTP_DURATION_BUCKETS_SECONDS[index];

      lines.push(
        [
          "salonai_http_request_duration_seconds_bucket",
          formatMetricLabels({
            ...series.labels,
            le: upperBound.toString(),
          }),
          " ",
          series.durationBuckets[index],
        ].join("")
      );
    }

    lines.push(
      [
        "salonai_http_request_duration_seconds_bucket",
        formatMetricLabels({
          ...series.labels,
          le: "+Inf",
        }),
        " ",
        series.durationCount,
      ].join("")
    );

    lines.push(
      [
        "salonai_http_request_duration_seconds_sum",
        formatMetricLabels(series.labels),
        " ",
        series.durationSumSeconds.toFixed(9),
      ].join("")
    );

    lines.push(
      [
        "salonai_http_request_duration_seconds_count",
        formatMetricLabels(series.labels),
        " ",
        series.durationCount,
      ].join("")
    );
  }

  addHelpAndType(
    lines,
    "salonai_http_requests_active",
    "Current number of active HTTP requests.",
    "gauge"
  );

  lines.push(
    `salonai_http_requests_active ${activeHttpRequests}`
  );

  addHelpAndType(
    lines,
    "salonai_http_aborted_requests_total",
    "Total number of HTTP requests closed before completion.",
    "counter"
  );

  lines.push(
    `salonai_http_aborted_requests_total ${abortedHttpRequests}`
  );
}

function renderReadinessMetrics(
  lines,
  readiness
) {
  addHelpAndType(
    lines,
    "salonai_backend_ready",
    "Whether the SalonAI backend is ready to serve traffic.",
    "gauge"
  );

  lines.push(
    `salonai_backend_ready ${
      readiness?.ready ? 1 : 0
    }`
  );

  addHelpAndType(
    lines,
    "salonai_mongodb_ready",
    "Whether the MongoDB connection is ready.",
    "gauge"
  );

  lines.push(
    `salonai_mongodb_ready ${
      readiness?.checks?.mongo?.ready ? 1 : 0
    }`
  );

  addHelpAndType(
    lines,
    "salonai_scheduler_ready",
    "Whether the message-delivery scheduler satisfies readiness requirements.",
    "gauge"
  );

  lines.push(
    `salonai_scheduler_ready ${
      readiness?.checks?.scheduler?.ready
        ? 1
        : 0
    }`
  );

  addHelpAndType(
    lines,
    "salonai_application_shutting_down",
    "Whether the backend is currently shutting down.",
    "gauge"
  );

  lines.push(
    `salonai_application_shutting_down ${
      readiness?.checks?.shutdown?.ready
        ? 0
        : 1
    }`
  );
}

function renderProcessMetrics(lines) {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();

  addHelpAndType(
    lines,
    "salonai_process_start_time_seconds",
    "Backend process start time in Unix seconds.",
    "gauge"
  );

  lines.push(
    `salonai_process_start_time_seconds ${processStartedAtSeconds}`
  );

  addHelpAndType(
    lines,
    "salonai_process_uptime_seconds",
    "Backend process uptime in seconds.",
    "gauge"
  );

  lines.push(
    `salonai_process_uptime_seconds ${process
      .uptime()
      .toFixed(3)}`
  );

  addHelpAndType(
    lines,
    "salonai_process_resident_memory_bytes",
    "Resident memory used by the backend process.",
    "gauge"
  );

  lines.push(
    `salonai_process_resident_memory_bytes ${memory.rss}`
  );

  addHelpAndType(
    lines,
    "salonai_nodejs_heap_used_bytes",
    "Node.js heap memory currently used.",
    "gauge"
  );

  lines.push(
    `salonai_nodejs_heap_used_bytes ${memory.heapUsed}`
  );

  addHelpAndType(
    lines,
    "salonai_nodejs_heap_total_bytes",
    "Total Node.js heap memory allocated.",
    "gauge"
  );

  lines.push(
    `salonai_nodejs_heap_total_bytes ${memory.heapTotal}`
  );

  addHelpAndType(
    lines,
    "salonai_nodejs_external_memory_bytes",
    "Node.js external memory allocation.",
    "gauge"
  );

  lines.push(
    `salonai_nodejs_external_memory_bytes ${memory.external}`
  );

  addHelpAndType(
    lines,
    "salonai_process_cpu_user_seconds_total",
    "Total user CPU time consumed by the process.",
    "counter"
  );

  lines.push(
    `salonai_process_cpu_user_seconds_total ${(
      cpu.user / 1_000_000
    ).toFixed(6)}`
  );

  addHelpAndType(
    lines,
    "salonai_process_cpu_system_seconds_total",
    "Total system CPU time consumed by the process.",
    "counter"
  );

  lines.push(
    `salonai_process_cpu_system_seconds_total ${(
      cpu.system / 1_000_000
    ).toFixed(6)}`
  );

  const eventLoopMeanNanoseconds =
    eventLoopDelay.mean;

  const eventLoopP99Nanoseconds =
    eventLoopDelay.percentile(99);

  const eventLoopMeanSeconds =
    Number.isFinite(eventLoopMeanNanoseconds)
      ? eventLoopMeanNanoseconds /
        1_000_000_000
      : 0;

  const eventLoopP99Seconds =
    Number.isFinite(eventLoopP99Nanoseconds)
      ? eventLoopP99Nanoseconds /
        1_000_000_000
      : 0;

  addHelpAndType(
    lines,
    "salonai_nodejs_eventloop_lag_mean_seconds",
    "Mean Node.js event-loop delay in seconds.",
    "gauge"
  );

  lines.push(
    `salonai_nodejs_eventloop_lag_mean_seconds ${eventLoopMeanSeconds.toFixed(
      9
    )}`
  );

  addHelpAndType(
    lines,
    "salonai_nodejs_eventloop_lag_p99_seconds",
    "99th percentile Node.js event-loop delay in seconds.",
    "gauge"
  );

  lines.push(
    `salonai_nodejs_eventloop_lag_p99_seconds ${eventLoopP99Seconds.toFixed(
      9
    )}`
  );
}

export function renderPrometheusMetrics({
  readiness,
} = {}) {
  const lines = [];

  addHelpAndType(
    lines,
    "salonai_backend_info",
    "Static information about the SalonAI backend.",
    "gauge"
  );

  lines.push(
    [
      "salonai_backend_info",
      formatMetricLabels({
        service:
          process.env.SERVICE_NAME ||
          "salonai-backend",

        environment:
          process.env.NODE_ENV ||
          "development",

        version:
          process.env.APP_VERSION ||
          "unknown",

        node_version: process.version,
      }),
      " 1",
    ].join("")
  );

  renderReadinessMetrics(lines, readiness);
  renderHttpMetrics(lines);
  renderProcessMetrics(lines);

  lines.push("");

  return lines.join("\n");
}

export function getMetricsContentType() {
  return METRICS_CONTENT_TYPE;
}

export function getMetricsSnapshot() {
  return {
    activeHttpRequests,
    abortedHttpRequests,
    seriesCount: httpRequestSeries.size,
  };
}
