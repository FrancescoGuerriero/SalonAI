import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import logger, { createLogger } from "./logger.js";
import { startHttpRequestMetric } from "./metrics.js";
import {
  startIncomingHttpSpan,
} from "./tracing.js";

const requestContextStorage = new AsyncLocalStorage();

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Safely reads a request header.
 *
 * @param {import("node:http").IncomingMessage} request
 * @param {string} name
 * @returns {string}
 */
function readHeader(request, name) {
  const value = request.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return String(value || "");
}

/**
 * Uses a valid incoming request ID or generates a new UUID.
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {string}
 */
function createRequestId(request) {
  const forwardedRequestId = readHeader(
    request,
    "x-request-id"
  ).trim();

  if (REQUEST_ID_PATTERN.test(forwardedRequestId)) {
    return forwardedRequestId;
  }

  return randomUUID();
}

/**
 * Resolves the original client IP address.
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {string | null}
 */
function readRemoteAddress(request) {
  const forwardedFor = readHeader(request, "x-forwarded-for")
    .split(",")[0]
    .trim();

  return forwardedFor || request.socket?.remoteAddress || null;
}

/**
 * Calculates elapsed time from a high-resolution start value.
 *
 * @param {bigint} startedAt
 * @returns {number}
 */
function getDurationMilliseconds(startedAt) {
  const elapsed = process.hrtime.bigint() - startedAt;

  return Number(elapsed) / 1_000_000;
}

/**
 * Prevents routine operational requests from filling production logs.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function shouldUseDebugLevel(pathname) {
  return [
    "/api/health",
    "/api/health/live",
    "/api/health/ready",
    "/internal/metrics",
  ].includes(pathname);
}

/**
 * Extracts a safe pathname from the incoming request URL.
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {string}
 */
function getPathname(request) {
  try {
    return new URL(
      request.url || "/",
      "http://localhost"
    ).pathname;
  } catch {
    return request.url || "/";
  }
}

/**
 * Returns the active asynchronous request context.
 *
 * @returns {object | null}
 */
export function getRequestContext() {
  return requestContextStorage.getStore() || null;
}

/**
 * Creates a logger enriched with the current request context.
 *
 * @param {Record<string, unknown>} additionalFields
 * @returns {ReturnType<typeof createLogger>}
 */
export function getRequestLogger(additionalFields = {}) {
  const context = getRequestContext();

  return createLogger({
    requestId: context?.requestId || null,
    traceparent: context?.traceparent || null,
    trace_id: context?.traceId || null,
    span_id: context?.spanId || null,
    ...additionalFields,
  });
}

/**
 * Executes an HTTP request inside an AsyncLocalStorage context.
 *
 * @param {import("node:http").IncomingMessage} request
 * @param {import("node:http").ServerResponse} response
 * @param {() => unknown} handler
 * @returns {unknown}
 */
export function runWithRequestContext(
  request,
  response,
  handler
) {
  const requestId = createRequestId(request);
  const startedAt = process.hrtime.bigint();
  const pathname = getPathname(request);
  const remoteAddress =
    readRemoteAddress(request);

  const traceSpan =
    startIncomingHttpSpan(
      request,
      {
        pathname,
        remoteAddress,
      }
    );

  traceSpan.setRequestId(requestId);

  const traceContext =
    traceSpan.context;

  const finishMetric = startHttpRequestMetric({
    method: request.method || "UNKNOWN",
    pathname,
  });

  const context = {
    requestId,
    traceparent:
      traceContext?.traceparent ||
      null,
    traceId:
      traceContext?.traceId ||
      null,
    spanId:
      traceContext?.spanId ||
      null,
    method: request.method || "UNKNOWN",
    pathname,
    startedAt: new Date().toISOString(),
    remoteAddress,
    userAgent: readHeader(request, "user-agent") || null,
  };

  request.requestId = requestId;
  request.traceId = context.traceId;
  request.spanId = context.spanId;

  if (!response.headersSent) {
    response.setHeader("X-Request-ID", requestId);

    if (context.traceId) {
      response.setHeader(
        "X-Trace-ID",
        context.traceId
      );
    }
  }

  return traceSpan.run(() =>
    requestContextStorage.run(
      context,
      () => {
        const requestLogger =
          getRequestLogger({
            method: context.method,
            pathname: context.pathname,
          });

        const healthRequest =
          shouldUseDebugLevel(pathname);

        if (healthRequest) {
          requestLogger.debug(
            "http.request.started",
            {
              event: "http.request.started",
              remoteAddress:
                context.remoteAddress,
              userAgent:
                context.userAgent,
            }
          );
        } else {
          requestLogger.info(
            "http.request.started",
            {
              event: "http.request.started",
              remoteAddress:
                context.remoteAddress,
              userAgent:
                context.userAgent,
            }
          );
        }

        let completed = false;

        response.once("finish", () => {
          completed = true;

          const durationMs =
            getDurationMilliseconds(
              startedAt
            );

          finishMetric({
            statusCode:
              response.statusCode,
            durationMs,
          });

          traceSpan.setAttribute(
            "http.response.body.size",
            Number(
              response.getHeader(
                "content-length"
              ) || 0
            )
          );

          traceSpan.end({
            statusCode:
              response.statusCode,
          });

          const fields = {
            event:
              "http.request.completed",
            statusCode:
              response.statusCode,
            durationMs:
              Number(
                durationMs.toFixed(3)
              ),
            contentLength:
              response.getHeader(
                "content-length"
              ) || null,
          };

          if (response.statusCode >= 500) {
            requestLogger.error(
              "http.request.completed",
              fields
            );
            return;
          }

          if (response.statusCode >= 400) {
            requestLogger.warn(
              "http.request.completed",
              fields
            );
            return;
          }

          if (healthRequest) {
            requestLogger.debug(
              "http.request.completed",
              fields
            );
            return;
          }

          requestLogger.info(
            "http.request.completed",
            fields
          );
        });

        response.once("close", () => {
          if (completed) {
            return;
          }

          const durationMs =
            getDurationMilliseconds(
              startedAt
            );

          finishMetric({
            statusCode: 499,
            durationMs,
            aborted: true,
          });

          traceSpan.end({
            statusCode: 499,
            aborted: true,
            error:
              new Error(
                "Client connection closed before the response completed."
              ),
          });

          requestLogger.warn(
            "http.request.aborted",
            {
              event:
                "http.request.aborted",
              durationMs:
                Number(
                  durationMs.toFixed(3)
                ),
            }
          );
        });

        try {
          return handler();
        } catch (error) {
          traceSpan.end({
            statusCode: 500,
            error,
          });

          logger.error(
            "http.request.dispatch_failed",
            {
              event:
                "http.request.dispatch_failed",
              requestId,
              traceparent:
                context.traceparent,
              method:
                context.method,
              pathname:
                context.pathname,
              error,
            }
          );

          throw error;
        }
      }
    )
  );
}
