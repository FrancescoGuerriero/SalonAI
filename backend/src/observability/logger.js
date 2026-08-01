import { getActiveTraceContext } from "./tracing.js";

const LOG_LEVEL_VALUES = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
});

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "jwt",
  "jwtSecret",
  "secret",
  "serviceKey",
  "apiKey",
  "openaiApiKey",
  "stripeSecretKey",
  "mongodbUri",
]);

const DEFAULT_SERVICE_NAME =
  "salonai-backend";

const DEFAULT_LOG_LEVEL =
  process.env.NODE_ENV === "production"
    ? "info"
    : "debug";

function normaliseLogLevel(value) {
  const candidate = String(
    value || ""
  )
    .trim()
    .toLowerCase();

  return Object.hasOwn(
    LOG_LEVEL_VALUES,
    candidate
  )
    ? candidate
    : DEFAULT_LOG_LEVEL;
}

const configuredLogLevel =
  normaliseLogLevel(
    process.env.LOG_LEVEL
  );

function shouldLog(level) {
  return (
    LOG_LEVEL_VALUES[level] >=
    LOG_LEVEL_VALUES[
      configuredLogLevel
    ]
  );
}

function isSensitiveKey(key) {
  const normalisedKey = String(
    key || ""
  )
    .replace(/[-_\s]/g, "")
    .toLowerCase();

  for (
    const sensitiveKey of
    REDACTED_KEYS
  ) {
    const normalisedSensitiveKey =
      sensitiveKey
        .replace(/[-_\s]/g, "")
        .toLowerCase();

    if (
      normalisedKey ===
      normalisedSensitiveKey
    ) {
      return true;
    }
  }

  return false;
}

function sanitiseValue(
  value,
  depth = 0,
  seen = new WeakSet()
) {
  if (depth > 6) {
    return "[Maximum depth reached]";
  }

  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name:
        value.name,

      message:
        value.message,

      code:
        value.code || null,

      stack:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : value.stack,

      cause:
        value.cause
          ? sanitiseValue(
              value.cause,
              depth + 1,
              seen
            )
          : undefined,
    };
  }

  if (
    typeof value !== "object"
  ) {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitiseValue(
        item,
        depth + 1,
        seen
      )
    );
  }

  const result = {};

  for (
    const [
      key,
      nestedValue,
    ] of Object.entries(value)
  ) {
    if (isSensitiveKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }

    result[key] =
      sanitiseValue(
        nestedValue,
        depth + 1,
        seen
      );
  }

  return result;
}

function createBaseRecord(
  level,
  message,
  fields = {}
) {
  const traceContext =
    getActiveTraceContext();

  return {
    timestamp:
      new Date().toISOString(),

    level,

    service:
      process.env.SERVICE_NAME ||
      DEFAULT_SERVICE_NAME,

    environment:
      process.env.NODE_ENV ||
      "development",

    pid:
      process.pid,

    message:
      String(message),

    ...sanitiseValue(fields),

    ...(
      traceContext
        ? {
            trace_id:
              traceContext.traceId,

            span_id:
              traceContext.spanId,

            trace_flags:
              traceContext.traceFlags,
          }
        : {}
    ),
  };
}

function writeRecord(record) {
  const serialised =
    JSON.stringify(record);

  if (
    record.level === "error" ||
    record.level === "fatal"
  ) {
    console.error(serialised);
    return;
  }

  if (record.level === "warn") {
    console.warn(serialised);
    return;
  }

  console.log(serialised);
}

function emit(
  level,
  message,
  fields
) {
  if (!shouldLog(level)) {
    return;
  }

  writeRecord(
    createBaseRecord(
      level,
      message,
      fields
    )
  );
}

export function createLogger(
  defaultFields = {}
) {
  return {
    debug(message, fields = {}) {
      emit(
        "debug",
        message,
        {
          ...defaultFields,
          ...fields,
        }
      );
    },

    info(message, fields = {}) {
      emit(
        "info",
        message,
        {
          ...defaultFields,
          ...fields,
        }
      );
    },

    warn(message, fields = {}) {
      emit(
        "warn",
        message,
        {
          ...defaultFields,
          ...fields,
        }
      );
    },

    error(message, fields = {}) {
      emit(
        "error",
        message,
        {
          ...defaultFields,
          ...fields,
        }
      );
    },

    fatal(message, fields = {}) {
      emit(
        "fatal",
        message,
        {
          ...defaultFields,
          ...fields,
        }
      );
    },

    child(fields = {}) {
      return createLogger({
        ...defaultFields,
        ...fields,
      });
    },
  };
}

const logger =
  createLogger();

export {
  configuredLogLevel,
  sanitiseValue,
};

export default logger;