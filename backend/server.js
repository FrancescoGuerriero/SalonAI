import "dotenv/config";

import {
  getTracingStatus,
  shutdownTracing,
} from "./src/observability/tracing.js";

import http from "node:http";
import mongoose from "mongoose";

import app from "./src/app.js";
import connectDB from "./src/config/db.js";

import logger from "./src/observability/logger.js";

import {
  getMetricsContentType,
  renderPrometheusMetrics,
} from "./src/observability/metrics.js";

import {
  getRequestContext,
  runWithRequestContext,
} from "./src/observability/requestContext.js";

import {
  getMessageDeliverySchedulerStatus,
  startMessageDeliveryScheduler,
  stopMessageDeliveryScheduler,
} from "./src/services/messageDeliverySchedulerService.js";

const DEFAULT_PORT = 5000;
const DEFAULT_HOST =
  "0.0.0.0";

const DEFAULT_SHUTDOWN_TIMEOUT_MS =
  30000;

const processStartedAt =
  new Date();

let server = null;
let startupCompleted = false;
let shuttingDown = false;
let shutdownPromise = null;

const activeSockets =
  new Set();

function getIntegerEnvironmentValue(
  name,
  fallback,
  minimum,
  maximum
) {
  const configuredValue =
    Number.parseInt(
      process.env[name],
      10
    );

  if (
    Number.isFinite(
      configuredValue
    ) &&
    configuredValue >= minimum &&
    configuredValue <= maximum
  ) {
    return configuredValue;
  }

  return fallback;
}

function getBooleanEnvironmentValue(
  name,
  fallback = false
) {
  const value =
    String(
      process.env[name] ?? ""
    )
      .trim()
      .toLowerCase();

  if (!value) {
    return fallback;
  }

  return [
    "true",
    "1",
    "yes",
    "on",
    "enabled",
  ].includes(value);
}

const PORT =
  getIntegerEnvironmentValue(
    "PORT",
    DEFAULT_PORT,
    1,
    65535
  );

const HOST =
  process.env.HOST ||
  DEFAULT_HOST;

const SHUTDOWN_TIMEOUT_MS =
  getIntegerEnvironmentValue(
    "SERVER_SHUTDOWN_TIMEOUT_MS",
    DEFAULT_SHUTDOWN_TIMEOUT_MS,
    5000,
    120000
  );

const METRICS_ENABLED =
  getBooleanEnvironmentValue(
    "METRICS_ENABLED",
    true
  );

function getMongoStatus() {
  const stateNames = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const readyState =
    mongoose.connection.readyState;

  return {
    ready:
      readyState === 1,

    state:
      stateNames[readyState] ||
      "unknown",

    readyState,

    host:
      mongoose.connection.host ||
      null,

    database:
      mongoose.connection.name ||
      null,
  };
}

function getSchedulerStatus() {
  const status =
    getMessageDeliverySchedulerStatus();

  const schedulerRequired =
    getBooleanEnvironmentValue(
      "MESSAGE_DELIVERY_SCHEDULER_ENABLED",
      false
    );

  return {
    ready:
      !status.stopping &&
      (
        !schedulerRequired ||
        status.started
      ),

    required:
      schedulerRequired,

    enabled:
      status.enabled,

    started:
      status.started,

    stopping:
      status.stopping,

    runningCycle:
      status.runningCycle,

    intervalMs:
      status.intervalMs,

    startedAt:
      status.startedAt,

    lastSuccessfulCycleAt:
      status.lastSuccessfulCycleAt,

    lastFailedCycleAt:
      status.lastFailedCycleAt,

    lastError:
      status.lastError,
  };
}

function getReadinessStatus() {
  const mongo =
    getMongoStatus();

  const scheduler =
    getSchedulerStatus();

  const checks = {
    startup: {
      ready:
        startupCompleted,

      status:
        startupCompleted
          ? "completed"
          : "starting",
    },

    shutdown: {
      ready:
        !shuttingDown,

      status:
        shuttingDown
          ? "shutting_down"
          : "running",
    },

    mongo,
    scheduler,
  };

  const ready =
    checks.startup.ready &&
    checks.shutdown.ready &&
    mongo.ready &&
    scheduler.ready;

  return {
    ready,

    status:
      ready
        ? "ready"
        : "not_ready",

    service:
      "salonai-backend",

    environment:
      process.env.NODE_ENV ||
      "development",

    timestamp:
      new Date().toISOString(),

    uptimeSeconds:
      Math.floor(
        process.uptime()
      ),

    startedAt:
      processStartedAt
        .toISOString(),

    requestId:
      getRequestContext()
        ?.requestId || null,

    checks,
  };
}

function writeJsonResponse(
  request,
  response,
  statusCode,
  payload
) {
  const body =
    JSON.stringify(payload);

  response.writeHead(
    statusCode,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(body),

      "Cache-Control":
        "no-store",

      "X-Content-Type-Options":
        "nosniff",
    }
  );

  if (
    request.method === "HEAD"
  ) {
    response.end();
    return;
  }

  response.end(body);
}

function writeTextResponse(
  request,
  response,
  statusCode,
  body,
  contentType
) {
  response.writeHead(
    statusCode,
    {
      "Content-Type":
        contentType,

      "Content-Length":
        Buffer.byteLength(body),

      "Cache-Control":
        "no-store",

      "X-Content-Type-Options":
        "nosniff",
    }
  );

  if (
    request.method === "HEAD"
  ) {
    response.end();
    return;
  }

  response.end(body);
}

function handleOperationalEndpoint(
  request,
  response
) {
  const method =
    request.method?.toUpperCase();

  if (
    method !== "GET" &&
    method !== "HEAD"
  ) {
    return false;
  }

  const requestUrl =
    new URL(
      request.url || "/",
      "http://localhost"
    );

  const pathname =
    requestUrl.pathname;

  if (
    pathname ===
    "/internal/metrics"
  ) {
    if (!METRICS_ENABLED) {
      writeJsonResponse(
        request,
        response,
        404,
        {
          success: false,

          message:
            "Metrics are disabled.",
        }
      );

      return true;
    }

    const readiness =
      getReadinessStatus();

    const body =
      renderPrometheusMetrics({
        readiness,
      });

    writeTextResponse(
      request,
      response,
      200,
      body,
      getMetricsContentType()
    );

    return true;
  }

  if (
    pathname ===
    "/api/health/live"
  ) {
    writeJsonResponse(
      request,
      response,
      200,
      {
        alive: true,

        status:
          shuttingDown
            ? "shutting_down"
            : "alive",

        service:
          "salonai-backend",

        timestamp:
          new Date()
            .toISOString(),

        uptimeSeconds:
          Math.floor(
            process.uptime()
          ),

        startedAt:
          processStartedAt
            .toISOString(),

        requestId:
          getRequestContext()
            ?.requestId || null,
      }
    );

    return true;
  }

  if (
    pathname ===
    "/api/health/ready"
  ) {
    const readiness =
      getReadinessStatus();

    writeJsonResponse(
      request,
      response,
      readiness.ready
        ? 200
        : 503,
      readiness
    );

    return true;
  }

  if (
    pathname ===
    "/api/health"
  ) {
    const readiness =
      getReadinessStatus();

    writeJsonResponse(
      request,
      response,
      readiness.ready
        ? 200
        : 503,
      {
        success:
          readiness.ready,

        ...readiness,
      }
    );

    return true;
  }

  return false;
}

function createHttpServer() {
  const httpServer =
    http.createServer(
      (request, response) =>
        runWithRequestContext(
          request,
          response,
          () => {
            if (
              handleOperationalEndpoint(
                request,
                response
              )
            ) {
              return;
            }

            app(
              request,
              response
            );
          }
        )
    );

  httpServer.keepAliveTimeout =
    65000;

  httpServer.headersTimeout =
    66000;

  httpServer.requestTimeout =
    30000;

  httpServer.on(
    "connection",
    (socket) => {
      activeSockets.add(socket);

      socket.on(
        "close",
        () => {
          activeSockets.delete(
            socket
          );
        }
      );
    }
  );

  httpServer.on(
    "clientError",
    (error, socket) => {
      logger.warn(
        "http.client_error",
        {
          event:
            "http.client_error",

          error,
        }
      );

      if (socket.writable) {
        socket.end(
          "HTTP/1.1 400 Bad Request\r\n" +
          "Connection: close\r\n" +
          "\r\n"
        );
      }
    }
  );

  httpServer.on(
    "error",
    (error) => {
      logger.error(
        "http.server_error",
        {
          event:
            "http.server_error",

          port:
            PORT,

          error,
        }
      );

      void shutdown(
        "SERVER_ERROR",
        1
      );
    }
  );

  return httpServer;
}

async function closeHttpServer() {
  if (
    !server ||
    !server.listening
  ) {
    return;
  }

  await new Promise(
    (resolve, reject) => {
      server.close(
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );

      if (
        typeof server
          .closeIdleConnections ===
        "function"
      ) {
        server
          .closeIdleConnections();
      }
    }
  );
}

async function closeScheduler() {
  const status =
    getMessageDeliverySchedulerStatus();

  if (
    !status.started &&
    !status.runningCycle
  ) {
    return;
  }

  await stopMessageDeliveryScheduler({
    waitForCycle: true,
  });
}

async function closeDatabase() {
  if (
    mongoose.connection
      .readyState === 0
  ) {
    return;
  }

  await mongoose.connection.close(
    false
  );
}

function destroyRemainingSockets() {
  for (
    const socket of
    activeSockets
  ) {
    socket.destroy();
  }

  activeSockets.clear();
}

async function shutdown(
  signal,
  exitCode = 0
) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shuttingDown = true;
  startupCompleted = false;

  shutdownPromise =
    (async () => {
      logger.warn(
        "application.shutdown_started",
        {
          event:
            "application.shutdown_started",

          signal,
          exitCode,

          activeConnections:
            activeSockets.size,

          timeoutMs:
            SHUTDOWN_TIMEOUT_MS,
        }
      );

      const forcedShutdownTimer =
        setTimeout(
          () => {
            logger.fatal(
              "application.shutdown_timeout",
              {
                event:
                  "application.shutdown_timeout",

                signal,

                activeConnections:
                  activeSockets.size,

                timeoutMs:
                  SHUTDOWN_TIMEOUT_MS,
              }
            );

            destroyRemainingSockets();

            process.exit(1);
          },
          SHUTDOWN_TIMEOUT_MS
        );

      forcedShutdownTimer.unref();

      try {
        await Promise.all([
          closeHttpServer(),
          closeScheduler(),
        ]);

        logger.info(
          "application.http_and_scheduler_stopped",
          {
            event:
              "application.http_and_scheduler_stopped",
          }
        );

        await closeDatabase();

        logger.info(
          "application.database_closed",
          {
            event:
              "application.database_closed",
          }
        );

        await shutdownTracing();

        clearTimeout(
          forcedShutdownTimer
        );

        logger.info(
          "application.shutdown_completed",
          {
            event:
              "application.shutdown_completed",

            signal,
            exitCode,
          }
        );

        process.exit(exitCode);
      }
      catch (error) {
        clearTimeout(
          forcedShutdownTimer
        );

        destroyRemainingSockets();

        logger.fatal(
          "application.shutdown_failed",
          {
            event:
              "application.shutdown_failed",

            signal,
            error,
          }
        );

        await shutdownTracing()
          .catch(() => undefined);

        process.exit(1);
      }
    })();

  return shutdownPromise;
}

async function initialiseScheduler() {
  const result =
    await startMessageDeliveryScheduler();

  if (!result.started) {
    logger.info(
      "scheduler.disabled",
      {
        event:
          "scheduler.disabled",

        message:
          result.message ||
          "Message-delivery scheduler is disabled.",
      }
    );

    return;
  }

  logger.info(
    "scheduler.started",
    {
      event:
        "scheduler.started",

      intervalMs:
        result.scheduler
          .intervalMs,

      initialCycle:
        result.initialCycle ||
        null,
    }
  );
}

async function startServer() {
  logger.info(
    "application.starting",
    {
      event:
        "application.starting",

      host:
        HOST,

      port:
        PORT,

      metricsEnabled:
        METRICS_ENABLED,

      logLevel:
        process.env.LOG_LEVEL ||
        (
          process.env.NODE_ENV ===
          "production"
            ? "info"
            : "debug"
        ),

      tracing:
        getTracingStatus(),
    }
  );

  if (
    !process.env.MONGODB_URI
  ) {
    throw new Error(
      "MONGODB_URI is missing from the backend environment configuration."
    );
  }

  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is missing from the backend environment configuration."
    );
  }

  await connectDB();

  logger.info(
    "database.connected",
    {
      event:
        "database.connected",

      host:
        mongoose.connection.host ||
        null,

      database:
        mongoose.connection.name ||
        null,
    }
  );

  server =
    createHttpServer();

  await new Promise(
    (resolve, reject) => {
      const handleStartupError =
        (error) => {
          server.off(
            "listening",
            handleListening
          );

          reject(error);
        };

      const handleListening =
        () => {
          server.off(
            "error",
            handleStartupError
          );

          resolve();
        };

      server.once(
        "error",
        handleStartupError
      );

      server.once(
        "listening",
        handleListening
      );

      server.listen(
        PORT,
        HOST
      );
    }
  );

  await initialiseScheduler();

  startupCompleted = true;

  logger.info(
    "application.ready",
    {
      event:
        "application.ready",

      host:
        HOST,

      port:
        PORT,

      environment:
        process.env.NODE_ENV ||
        "development",

      metricsPath:
        METRICS_ENABLED
          ? "/internal/metrics"
          : null,

      livenessPath:
        "/api/health/live",

      readinessPath:
        "/api/health/ready",
    }
  );
}

process.on(
  "SIGINT",
  () => {
    void shutdown(
      "SIGINT",
      0
    );
  }
);

process.on(
  "SIGTERM",
  () => {
    void shutdown(
      "SIGTERM",
      0
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    logger.fatal(
      "application.unhandled_rejection",
      {
        event:
          "application.unhandled_rejection",

        reason:
          reason instanceof Error
            ? reason
            : String(reason),
      }
    );

    void shutdown(
      "UNHANDLED_REJECTION",
      1
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    logger.fatal(
      "application.uncaught_exception",
      {
        event:
          "application.uncaught_exception",

        error,
      }
    );

    void shutdown(
      "UNCAUGHT_EXCEPTION",
      1
    );
  }
);

startServer().catch(
  (error) => {
    logger.fatal(
      "application.startup_failed",
      {
        event:
          "application.startup_failed",

        error,
      }
    );

    void shutdown(
      "STARTUP_ERROR",
      1
    );
  }
);