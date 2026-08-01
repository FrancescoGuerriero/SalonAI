import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;
const TRACEPARENT_PATTERN =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(?:-.*)?$/i;

const DEFAULT_EXPORT_ENDPOINT =
  "http://127.0.0.1:4318/v1/traces";

const DEFAULT_SERVICE_NAME =
  "salonai-backend";

const DEFAULT_EXPORT_TIMEOUT_MS =
  5000;

const MAX_QUEUE_SIZE = 2048;
const MAX_BATCH_SIZE = 128;
const FLUSH_INTERVAL_MS = 1000;

const activeSpanStorage =
  new AsyncLocalStorage();

const completedSpans = [];

const originalFetch =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;

let flushTimer = null;
let flushPromise = null;
let tracingShuttingDown = false;
let lastExportWarningAt = 0;

function readBooleanEnvironmentValue(
  name,
  fallback = true
) {
  const value = String(
    process.env[name] ?? ""
  )
    .trim()
    .toLowerCase();

  if (!value) {
    return fallback;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
    ].includes(value)
  ) {
    return false;
  }

  return [
    "true",
    "1",
    "yes",
    "on",
    "enabled",
  ].includes(value)
    ? true
    : fallback;
}

function readIntegerEnvironmentValue(
  name,
  fallback,
  minimum,
  maximum
) {
  const value = Number.parseInt(
    process.env[name],
    10
  );

  if (
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    return value;
  }

  return fallback;
}

function readSampleRatio() {
  const value = Number.parseFloat(
    process.env.OTEL_TRACES_SAMPLER_ARG
  );

  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(
    1,
    Math.max(0, value)
  );
}

const tracingEnabled =
  readBooleanEnvironmentValue(
    "TRACING_ENABLED",
    true
  );

const exportEndpoint = String(
  process.env
    .OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    DEFAULT_EXPORT_ENDPOINT
).trim();

const exportTimeoutMs =
  readIntegerEnvironmentValue(
    "TRACE_EXPORT_TIMEOUT_MS",
    DEFAULT_EXPORT_TIMEOUT_MS,
    500,
    30000
  );

const sampleRatio =
  readSampleRatio();

function createHexIdentifier(byteLength) {
  return randomBytes(byteLength)
    .toString("hex");
}

function isAllZeroIdentifier(value) {
  return /^0+$/.test(value);
}

function createTraceId() {
  let traceId = createHexIdentifier(16);

  while (isAllZeroIdentifier(traceId)) {
    traceId = createHexIdentifier(16);
  }

  return traceId;
}

function createSpanId() {
  let spanId = createHexIdentifier(8);

  while (isAllZeroIdentifier(spanId)) {
    spanId = createHexIdentifier(8);
  }

  return spanId;
}

function parseTraceparent(value) {
  const candidate = String(value || "")
    .trim()
    .toLowerCase();

  const match =
    TRACEPARENT_PATTERN.exec(candidate);

  if (!match) {
    return null;
  }

  const [
    ,
    version,
    traceId,
    parentSpanId,
    flags,
  ] = match;

  if (
    version === "ff" ||
    !TRACE_ID_PATTERN.test(traceId) ||
    !SPAN_ID_PATTERN.test(parentSpanId) ||
    isAllZeroIdentifier(traceId) ||
    isAllZeroIdentifier(parentSpanId)
  ) {
    return null;
  }

  return {
    version,
    traceId,
    parentSpanId,
    flags,
    sampled:
      (Number.parseInt(flags, 16) & 1) === 1,
  };
}

function shouldSampleRootSpan() {
  if (sampleRatio <= 0) {
    return false;
  }

  if (sampleRatio >= 1) {
    return true;
  }

  return Math.random() < sampleRatio;
}

function normaliseAttributeValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((item) =>
      [
        "string",
        "boolean",
        "number",
      ].includes(typeof item)
    )
  ) {
    return value;
  }

  return String(value);
}

function parseResourceAttributes() {
  const attributes = {
    "service.name":
      process.env.OTEL_SERVICE_NAME ||
      process.env.SERVICE_NAME ||
      DEFAULT_SERVICE_NAME,

    "service.namespace":
      "salonai",

    "deployment.environment.name":
      process.env.NODE_ENV ||
      "development",

    "service.version":
      process.env.APP_VERSION ||
      "unknown",
  };

  const configuredAttributes =
    String(
      process.env
        .OTEL_RESOURCE_ATTRIBUTES ||
        ""
    ).trim();

  if (!configuredAttributes) {
    return attributes;
  }

  for (
    const entry of
    configuredAttributes.split(",")
  ) {
    const separatorIndex =
      entry.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = entry
      .slice(0, separatorIndex)
      .trim();

    const value = entry
      .slice(separatorIndex + 1)
      .trim();

    if (key && value) {
      attributes[key] = value;
    }
  }

  return attributes;
}

const resourceAttributes =
  parseResourceAttributes();

function getUnixTimeNanoseconds() {
  return BigInt(Date.now()) *
    1_000_000n;
}

function createSpan({
  name,
  kind,
  traceId,
  parentSpanId = null,
  sampled,
  attributes = {},
}) {
  const span = {
    name,
    kind,
    traceId,
    spanId: createSpanId(),
    parentSpanId,
    sampled,
    flags: sampled ? "01" : "00",
    startedAtUnixNano:
      getUnixTimeNanoseconds(),
    endedAtUnixNano: null,
    attributes: {},
    statusCode: 0,
    statusMessage: "",
    ended: false,
  };

  for (
    const [key, value] of
    Object.entries(attributes)
  ) {
    const normalised =
      normaliseAttributeValue(value);

    if (normalised !== undefined) {
      span.attributes[key] =
        normalised;
    }
  }

  return span;
}

function formatTraceparent(span) {
  return [
    "00",
    span.traceId,
    span.spanId,
    span.flags,
  ].join("-");
}

function createPublicContext(span) {
  if (!span) {
    return null;
  }

  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId:
      span.parentSpanId || null,
    sampled: span.sampled,
    traceFlags: span.flags,
    traceparent:
      formatTraceparent(span),
    requestId:
      span.attributes["salonai.request_id"] ||
      null,
  };
}

function setSpanAttribute(
  span,
  key,
  value
) {
  if (!span || span.ended) {
    return;
  }

  const normalised =
    normaliseAttributeValue(value);

  if (normalised === undefined) {
    return;
  }

  span.attributes[String(key)] =
    normalised;
}

function finishSpan(
  span,
  {
    statusCode,
    error,
    aborted = false,
  } = {}
) {
  if (!span || span.ended) {
    return;
  }

  span.endedAtUnixNano =
    getUnixTimeNanoseconds();

  if (
    Number.isFinite(statusCode)
  ) {
    setSpanAttribute(
      span,
      "http.response.status_code",
      Number(statusCode)
    );
  }

  if (aborted) {
    setSpanAttribute(
      span,
      "salonai.request_aborted",
      true
    );
  }

  if (error) {
    span.statusCode = 2;
    span.statusMessage =
      error instanceof Error
        ? error.message
        : String(error);

    setSpanAttribute(
      span,
      "error.type",
      error instanceof Error
        ? error.name
        : "Error"
    );

    setSpanAttribute(
      span,
      "error.message",
      span.statusMessage
    );
  } else if (
    Number.isFinite(statusCode) &&
    Number(statusCode) >= 500
  ) {
    span.statusCode = 2;
    span.statusMessage =
      `HTTP ${statusCode}`;
  } else {
    span.statusCode = 1;
  }

  span.ended = true;

  if (span.sampled) {
    enqueueCompletedSpan(span);
  }
}

function toOtlpAnyValue(value) {
  if (typeof value === "string") {
    return {
      stringValue: value,
    };
  }

  if (typeof value === "boolean") {
    return {
      boolValue: value,
    };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return {
        intValue: String(value),
      };
    }

    return {
      doubleValue: value,
    };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values:
          value.map(
            toOtlpAnyValue
          ),
      },
    };
  }

  return {
    stringValue: String(value),
  };
}

function toOtlpAttributes(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) =>
      value !== undefined &&
      value !== null
    )
    .map(([key, value]) => ({
      key,
      value:
        toOtlpAnyValue(value),
    }));
}

function normaliseOtlpHexIdentifier(
  value,
  expectedLength
) {
  const identifier = String(value || "")
    .trim()
    .toLowerCase();

  if (
    identifier.length !== expectedLength ||
    !/^[0-9a-f]+$/.test(identifier) ||
    isAllZeroIdentifier(identifier)
  ) {
    throw new Error(
      `Invalid OTLP hexadecimal identifier: ${identifier}`
    );
  }

  return identifier;
}

function toOtlpSpan(span) {
  const result = {
    traceId:
      normaliseOtlpHexIdentifier(
        span.traceId,
        32
      ),

    spanId:
      normaliseOtlpHexIdentifier(
        span.spanId,
        16
      ),

    traceState: "",

    flags:
      span.sampled ? 1 : 0,

    name:
      span.name,

    kind:
      span.kind,

    startTimeUnixNano:
      String(
        span.startedAtUnixNano
      ),

    endTimeUnixNano:
      String(
        span.endedAtUnixNano ||
        getUnixTimeNanoseconds()
      ),

    attributes:
      toOtlpAttributes(
        span.attributes
      ),

    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,

    status: {
      message:
        span.statusMessage || "",

      code:
        span.statusCode,
    },
  };

  if (span.parentSpanId) {
    result.parentSpanId =
      normaliseOtlpHexIdentifier(
        span.parentSpanId,
        16
      );
  }

  return result;
}

function createOtlpPayload(spans) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes:
            toOtlpAttributes(
              resourceAttributes
            ),

          droppedAttributesCount: 0,
        },

        scopeSpans: [
          {
            scope: {
              name:
                "salonai.manual-otel",

              version:
                "1.0.0",
            },

            spans:
              spans.map(
                toOtlpSpan
              ),
          },
        ],
      },
    ],
  };
}

function scheduleFlush() {
  if (
    flushTimer ||
    tracingShuttingDown ||
    !tracingEnabled
  ) {
    return;
  }

  flushTimer = setTimeout(
    () => {
      flushTimer = null;
      void flushCompletedSpans();
    },
    FLUSH_INTERVAL_MS
  );

  flushTimer.unref();
}

function enqueueCompletedSpan(span) {
  if (
    !tracingEnabled ||
    tracingShuttingDown
  ) {
    return;
  }

  if (
    completedSpans.length >=
    MAX_QUEUE_SIZE
  ) {
    completedSpans.shift();
  }

  completedSpans.push(span);

  if (
    completedSpans.length >=
    MAX_BATCH_SIZE
  ) {
    void flushCompletedSpans();
    return;
  }

  scheduleFlush();
}

function warnExportFailure(error) {
  const now = Date.now();

  if (
    now - lastExportWarningAt <
    60000
  ) {
    return;
  }

  lastExportWarningAt = now;

  console.warn(
    JSON.stringify({
      timestamp:
        new Date().toISOString(),
      level: "warn",
      service:
        resourceAttributes[
          "service.name"
        ],
      event:
        "tracing.export_failed",
      endpoint:
        exportEndpoint,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    })
  );
}

async function exportBatch(spans) {
  if (
    !originalFetch ||
    !exportEndpoint ||
    spans.length === 0
  ) {
    return;
  }

  const response = await originalFetch(
    exportEndpoint,
    {
      method: "POST",
      headers: {
        Accept:
          "application/json",
        "Content-Type":
          "application/json",
      },
      body:
        JSON.stringify(
          createOtlpPayload(spans)
        ),
      signal:
        AbortSignal.timeout(
          exportTimeoutMs
        ),
    }
  );

  if (!response.ok) {
    const responseBody =
      await response.text()
        .catch(() => "");

    throw new Error(
      [
        `OTLP trace export returned HTTP ${response.status}.`,
        responseBody.slice(0, 300),
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

export async function flushCompletedSpans() {
  if (
    !tracingEnabled ||
    completedSpans.length === 0
  ) {
    return;
  }

  if (flushPromise) {
    return flushPromise;
  }

  const batch =
    completedSpans.splice(
      0,
      MAX_BATCH_SIZE
    );

  flushPromise =
    exportBatch(batch)
      .catch((error) => {
        warnExportFailure(error);

        if (!tracingShuttingDown) {
          const availableCapacity =
            Math.max(
              0,
              MAX_QUEUE_SIZE -
              completedSpans.length
            );

          if (availableCapacity > 0) {
            completedSpans.unshift(
              ...batch.slice(
                -availableCapacity
              )
            );
          }
        }
      })
      .finally(() => {
        flushPromise = null;

        if (
          completedSpans.length > 0 &&
          !tracingShuttingDown
        ) {
          scheduleFlush();
        }
      });

  return flushPromise;
}

export function getActiveTraceContext() {
  return createPublicContext(
    activeSpanStorage.getStore() ||
    null
  );
}

export function setActiveTraceAttribute(
  key,
  value
) {
  setSpanAttribute(
    activeSpanStorage.getStore(),
    key,
    value
  );
}

export function setActiveRequestId(
  requestId
) {
  setActiveTraceAttribute(
    "salonai.request_id",
    requestId
  );
}

export function startIncomingHttpSpan(
  request,
  {
    pathname = "/",
    remoteAddress = null,
  } = {}
) {
  const incomingTrace =
    parseTraceparent(
      request.headers?.traceparent
    );

  const sampled =
    incomingTrace
      ? incomingTrace.sampled
      : shouldSampleRootSpan();

  const method =
    String(
      request.method ||
      "UNKNOWN"
    ).toUpperCase();

  const span = createSpan({
    name:
      `${method} ${pathname}`,

    kind: 2,

    traceId:
      incomingTrace?.traceId ||
      createTraceId(),

    parentSpanId:
      incomingTrace?.parentSpanId ||
      null,

    sampled,

    attributes: {
      "http.request.method":
        method,
      "url.path":
        pathname,
      "url.scheme":
        request.socket?.encrypted
          ? "https"
          : "http",
      "network.peer.address":
        remoteAddress,
      "user_agent.original":
        request.headers?.[
          "user-agent"
        ] || null,
    },
  });

  return {
    context:
      createPublicContext(span),

    run(handler) {
      return activeSpanStorage.run(
        span,
        handler
      );
    },

    setAttribute(key, value) {
      setSpanAttribute(
        span,
        key,
        value
      );
    },

    setRequestId(requestId) {
      setSpanAttribute(
        span,
        "salonai.request_id",
        requestId
      );
    },

    end(options = {}) {
      finishSpan(
        span,
        options
      );
    },
  };
}

function getRequestUrl(input) {
  try {
    if (
      typeof Request !== "undefined" &&
      input instanceof Request
    ) {
      return new URL(input.url);
    }

    if (input instanceof URL) {
      return input;
    }

    return new URL(String(input));
  } catch {
    return null;
  }
}

function getRequestMethod(
  input,
  init
) {
  const configuredMethod =
    init?.method ||
    (
      typeof Request !== "undefined" &&
      input instanceof Request
        ? input.method
        : null
    ) ||
    "GET";

  return String(configuredMethod)
    .toUpperCase();
}

function createOutgoingHeaders(
  input,
  init,
  parentContext,
  childSpan
) {
  const headers = new Headers(
    typeof Request !== "undefined" &&
    input instanceof Request
      ? input.headers
      : undefined
  );

  if (init?.headers) {
    const configuredHeaders =
      new Headers(init.headers);

    configuredHeaders.forEach(
      (value, key) => {
        headers.set(key, value);
      }
    );
  }

  headers.set(
    "traceparent",
    formatTraceparent(childSpan)
  );

  if (parentContext?.requestId) {
    headers.set(
      "x-request-id",
      parentContext.requestId
    );
  }

  return headers;
}

function installFetchInstrumentation() {
  if (
    !tracingEnabled ||
    !originalFetch ||
    globalThis.fetch?.[
      "__salonaiTracingPatched"
    ]
  ) {
    return;
  }

  const tracedFetch =
    async function tracedFetch(
      input,
      init = undefined
    ) {
      const parentSpan =
        activeSpanStorage.getStore();

      if (!parentSpan) {
        return originalFetch(
          input,
          init
        );
      }

      const requestUrl =
        getRequestUrl(input);

      const method =
        getRequestMethod(
          input,
          init
        );

      const childSpan = createSpan({
        name:
          `${method} ${
            requestUrl?.hostname ||
            "remote-service"
          }`,

        kind: 3,

        traceId:
          parentSpan.traceId,

        parentSpanId:
          parentSpan.spanId,

        sampled:
          parentSpan.sampled,

        attributes: {
          "http.request.method":
            method,
          "server.address":
            requestUrl?.hostname ||
            null,
          "server.port":
            requestUrl?.port
              ? Number(
                  requestUrl.port
                )
              : null,
          "url.full":
            requestUrl?.toString() ||
            String(input),
          "url.scheme":
            requestUrl?.protocol
              ?.replace(":", "") ||
            null,
        },
      });

      const parentContext =
        createPublicContext(
          parentSpan
        );

      const headers =
        createOutgoingHeaders(
          input,
          init,
          parentContext,
          childSpan
        );

      return activeSpanStorage.run(
        childSpan,
        async () => {
          try {
            const response =
              await originalFetch(
                input,
                {
                  ...(init || {}),
                  headers,
                }
              );

            finishSpan(
              childSpan,
              {
                statusCode:
                  response.status,
              }
            );

            return response;
          } catch (error) {
            finishSpan(
              childSpan,
              {
                error,
              }
            );

            throw error;
          }
        }
      );
    };

  Object.defineProperty(
    tracedFetch,
    "__salonaiTracingPatched",
    {
      value: true,
    }
  );

  globalThis.fetch = tracedFetch;
}

export async function shutdownTracing() {
  tracingShuttingDown = true;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (flushPromise) {
    await flushPromise;
  }

  while (
    completedSpans.length > 0
  ) {
    const batch =
      completedSpans.splice(
        0,
        MAX_BATCH_SIZE
      );

    try {
      await exportBatch(batch);
    } catch (error) {
      warnExportFailure(error);
      break;
    }
  }
}

export function getTracingStatus() {
  return {
    enabled:
      tracingEnabled,
    endpoint:
      exportEndpoint,
    serviceName:
      resourceAttributes[
        "service.name"
      ],
    sampleRatio,
    queuedSpans:
      completedSpans.length,
  };
}

installFetchInstrumentation();
