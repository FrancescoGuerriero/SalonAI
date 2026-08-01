import {
  processBatch,
} from "../features/scheduler/schedulerService.js";

const DEFAULT_INTERVAL_MS =
  60 * 1000;

const MINIMUM_INTERVAL_MS =
  10 * 1000;

const MAXIMUM_INTERVAL_MS =
  24 * 60 * 60 * 1000;

const DEFAULT_BATCH_SIZE = 25;

const jobState = {
  timer: null,
  currentCyclePromise: null,

  enabled: false,
  started: false,
  stopping: false,

  intervalMs:
    DEFAULT_INTERVAL_MS,

  batchSize:
    DEFAULT_BATCH_SIZE,

  runImmediately: true,

  startedAt: null,
  stoppedAt: null,

  lastCycleStartedAt: null,
  lastCycleCompletedAt: null,
  lastSuccessfulCycleAt: null,
  lastFailedCycleAt: null,

  totalCycles: 0,
  successfulCycles: 0,
  failedCycles: 0,
  skippedCycles: 0,

  totalProcessed: 0,
  totalSent: 0,
  totalDelivered: 0,
  totalQueuedForRetry: 0,
  totalFailed: 0,

  lastCycle: null,
  lastError: null,
};

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalisedValue =
    normaliseText(value)
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(
      normalisedValue
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
    ].includes(
      normalisedValue
    )
  ) {
    return false;
  }

  return fallback;
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.floor(number)
    )
  );
}

function serialiseError(error) {
  if (!error) {
    return null;
  }

  return {
    message:
      error.message ||
      "Scheduled communication worker error.",

    code:
      error.code ||
      "SCHEDULED_COMMUNICATION_JOB_ERROR",

    statusCode:
      Number(
        error.statusCode ||
          error.status
      ) || 500,

    stack:
      process.env.NODE_ENV ===
      "production"
        ? undefined
        : error.stack,
  };
}

function createCommunicationSchedulerError(
  message,
  {
    statusCode = 500,
    code =
      "SCHEDULED_COMMUNICATION_JOB_ERROR",
    cause = null,
    details = null,
  } = {}
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.code =
    code;

  error.details =
    details;

  if (cause) {
    error.cause =
      cause;
  }

  return error;
}

function getCommunicationSchedulerConfiguration(
  overrides = {}
) {
  return {
    enabled:
      overrides.enabled ??
      normaliseBoolean(
        process.env
          .SCHEDULED_COMMUNICATION_JOB_ENABLED,
        false
      ),

    intervalMs:
      normaliseInteger(
        overrides.intervalMs ??
          process.env
            .SCHEDULED_COMMUNICATION_JOB_INTERVAL_MS,
        DEFAULT_INTERVAL_MS,
        MINIMUM_INTERVAL_MS,
        MAXIMUM_INTERVAL_MS
      ),

    batchSize:
      normaliseInteger(
        overrides.batchSize ??
          process.env
            .SCHEDULED_COMMUNICATION_JOB_BATCH_SIZE,
        DEFAULT_BATCH_SIZE,
        1,
        500
      ),

    runImmediately:
      overrides.runImmediately ??
      normaliseBoolean(
        process.env
          .SCHEDULED_COMMUNICATION_JOB_RUN_IMMEDIATELY,
        true
      ),

    unrefTimer:
      overrides.unrefTimer ??
      normaliseBoolean(
        process.env
          .SCHEDULED_COMMUNICATION_JOB_UNREF_TIMER,
        true
      ),
  };
}

function getCommunicationSchedulerStatus() {
  return {
    enabled:
      jobState.enabled,

    started:
      jobState.started,

    stopping:
      jobState.stopping,

    runningCycle:
      Boolean(
        jobState
          .currentCyclePromise
      ),

    configuration: {
      intervalMs:
        jobState.intervalMs,

      batchSize:
        jobState.batchSize,

      runImmediately:
        jobState.runImmediately,
    },

    startedAt:
      jobState.startedAt,

    stoppedAt:
      jobState.stoppedAt,

    lastCycleStartedAt:
      jobState
        .lastCycleStartedAt,

    lastCycleCompletedAt:
      jobState
        .lastCycleCompletedAt,

    lastSuccessfulCycleAt:
      jobState
        .lastSuccessfulCycleAt,

    lastFailedCycleAt:
      jobState
        .lastFailedCycleAt,

    counters: {
      totalCycles:
        jobState.totalCycles,

      successfulCycles:
        jobState
          .successfulCycles,

      failedCycles:
        jobState.failedCycles,

      skippedCycles:
        jobState
          .skippedCycles,

      processed:
        jobState.totalProcessed,

      sent:
        jobState.totalSent,

      delivered:
        jobState.totalDelivered,

      queuedForRetry:
        jobState
          .totalQueuedForRetry,

      failed:
        jobState.totalFailed,
    },

    lastCycle:
      jobState.lastCycle,

    lastError:
      jobState.lastError,
  };
}

function createSkippedResult(
  reason
) {
  const timestamp =
    new Date()
      .toISOString();

  jobState.skippedCycles +=
    1;

  return {
    success: true,
    skipped: true,
    reason,

    startedAt:
      timestamp,

    completedAt:
      timestamp,

    processed: 0,
    sent: 0,
    delivered: 0,
    queuedForRetry: 0,
    failed: 0,
    items: [],
  };
}

function summariseProcessedItems(
  items
) {
  return items.reduce(
    (summary, item) => {
      const status =
        normaliseText(
          item?.status
        ).toLowerCase();

      summary.processed +=
        1;

      if (
        status === "sent"
      ) {
        summary.sent += 1;
      }

      if (
        [
          "delivered",
          "opened",
          "responded",
        ].includes(status)
      ) {
        summary.delivered +=
          1;
      }

      if (
        status === "queued"
      ) {
        summary.queuedForRetry +=
          1;
      }

      if (
        status === "failed"
      ) {
        summary.failed +=
          1;
      }

      return summary;
    },
    {
      processed: 0,
      sent: 0,
      delivered: 0,
      queuedForRetry: 0,
      failed: 0,
    }
  );
}

async function executeCommunicationSchedulerCycle(
  configuration,
  source
) {
  const startedAt =
    new Date();

  jobState.lastCycleStartedAt =
    startedAt.toISOString();

  jobState.totalCycles +=
    1;

  try {
    const items =
      await processBatch(
        configuration.batchSize
      );

    const counts =
      summariseProcessedItems(
        items
      );

    const completedAt =
      new Date();

    const success =
      counts.failed === 0;

    const result = {
      success,
      skipped: false,
      source,

      startedAt:
        startedAt.toISOString(),

      completedAt:
        completedAt.toISOString(),

      durationMs:
        completedAt.getTime() -
        startedAt.getTime(),

      configuration: {
        batchSize:
          configuration.batchSize,
      },

      ...counts,

      items,
    };

    jobState.lastCycleCompletedAt =
      completedAt.toISOString();

    jobState.lastCycle =
      result;

    jobState.totalProcessed +=
      counts.processed;

    jobState.totalSent +=
      counts.sent;

    jobState.totalDelivered +=
      counts.delivered;

    jobState.totalQueuedForRetry +=
      counts.queuedForRetry;

    jobState.totalFailed +=
      counts.failed;

    if (success) {
      jobState.successfulCycles +=
        1;

      jobState.lastSuccessfulCycleAt =
        completedAt.toISOString();

      jobState.lastError =
        null;
    } else {
      jobState.failedCycles +=
        1;

      jobState.lastFailedCycleAt =
        completedAt.toISOString();

      jobState.lastError = {
        message:
          "One or more scheduled communications failed permanently.",

        code:
          "SCHEDULED_COMMUNICATION_PARTIAL_FAILURE",

        failed:
          counts.failed,
      };
    }

    if (
      counts.processed > 0
    ) {
      console.log(
        [
          "SalonAI scheduled communication cycle:",
          `${counts.processed} processed,`,
          `${counts.sent} sent,`,
          `${counts.delivered} delivered,`,
          `${counts.queuedForRetry} queued for retry,`,
          `${counts.failed} failed.`,
        ].join(" ")
      );
    }

    return result;
  } catch (error) {
    const completedAt =
      new Date();

    jobState.failedCycles +=
      1;

    jobState.lastCycleCompletedAt =
      completedAt.toISOString();

    jobState.lastFailedCycleAt =
      completedAt.toISOString();

    jobState.lastError =
      serialiseError(error);

    const result = {
      success: false,
      skipped: false,
      source,

      startedAt:
        startedAt.toISOString(),

      completedAt:
        completedAt.toISOString(),

      durationMs:
        completedAt.getTime() -
        startedAt.getTime(),

      processed: 0,
      sent: 0,
      delivered: 0,
      queuedForRetry: 0,
      failed: 0,
      items: [],

      error:
        serialiseError(error),
    };

    jobState.lastCycle =
      result;

    console.error(
      "Scheduled communication job failed:",
      error
    );

    return result;
  }
}

async function runCommunicationSchedulerCycle(
  options = {}
) {
  const configuration =
    getCommunicationSchedulerConfiguration(
      options
    );

  const force =
    normaliseBoolean(
      options.force,
      false
    );

  if (
    !configuration.enabled &&
    !force
  ) {
    return createSkippedResult(
      "The scheduled communication job is disabled."
    );
  }

  if (
    jobState
      .currentCyclePromise
  ) {
    return createSkippedResult(
      "A scheduled communication cycle is already running."
    );
  }

  if (
    jobState.stopping
  ) {
    return createSkippedResult(
      "The scheduled communication job is stopping."
    );
  }

  const source =
    normaliseText(
      options.source
    ) || "manual";

  const cyclePromise =
    executeCommunicationSchedulerCycle(
      configuration,
      source
    );

  jobState.currentCyclePromise =
    cyclePromise;

  try {
    return await cyclePromise;
  } finally {
    jobState.currentCyclePromise =
      null;
  }
}

function scheduleCommunicationCycles(
  configuration
) {
  const timer =
    setInterval(() => {
      void runCommunicationSchedulerCycle({
        ...configuration,
        enabled: true,
        source: "interval",
      }).catch((error) => {
        console.error(
          "Scheduled communication interval failed:",
          error
        );
      });
    }, configuration.intervalMs);

  if (
    configuration.unrefTimer &&
    typeof timer.unref ===
      "function"
  ) {
    timer.unref();
  }

  return timer;
}

async function startCommunicationScheduler(
  options = {}
) {
  const configuration =
    getCommunicationSchedulerConfiguration(
      options
    );

  const force =
    normaliseBoolean(
      options.force,
      false
    );

  if (
    jobState.started &&
    jobState.timer
  ) {
    return {
      success: true,
      started: false,
      alreadyRunning: true,

      message:
        "The scheduled communication job is already running.",

      job:
        getCommunicationSchedulerStatus(),
    };
  }

  if (
    !configuration.enabled &&
    !force
  ) {
    jobState.enabled =
      false;

    return {
      success: true,
      started: false,
      alreadyRunning: false,

      message:
        "The scheduled communication job is disabled.",

      job:
        getCommunicationSchedulerStatus(),
    };
  }

  jobState.enabled =
    true;

  jobState.started =
    true;

  jobState.stopping =
    false;

  jobState.intervalMs =
    configuration.intervalMs;

  jobState.batchSize =
    configuration.batchSize;

  jobState.runImmediately =
    configuration.runImmediately;

  jobState.startedAt =
    new Date().toISOString();

  jobState.stoppedAt =
    null;

  jobState.timer =
    scheduleCommunicationCycles(
      configuration
    );

  let initialCycle =
    null;

  if (
    configuration.runImmediately
  ) {
    initialCycle =
      await runCommunicationSchedulerCycle({
        ...configuration,
        enabled: true,
        source: "startup",
      });
  }

  return {
    success: true,
    started: true,
    alreadyRunning: false,

    message:
      "Scheduled communication job started successfully.",

    initialCycle,

    job:
      getCommunicationSchedulerStatus(),
  };
}

async function stopCommunicationScheduler({
  waitForCycle = true,
} = {}) {
  jobState.stopping =
    true;

  if (jobState.timer) {
    clearInterval(
      jobState.timer
    );

    jobState.timer =
      null;
  }

  if (
    waitForCycle &&
    jobState
      .currentCyclePromise
  ) {
    try {
      await jobState
        .currentCyclePromise;
    } catch (error) {
      jobState.lastError =
        serialiseError(error);
    }
  }

  jobState.started =
    false;

  jobState.enabled =
    false;

  jobState.stopping =
    false;

  jobState.stoppedAt =
    new Date().toISOString();

  return {
    success: true,

    message:
      "Scheduled communication job stopped successfully.",

    job:
      getCommunicationSchedulerStatus(),
  };
}

async function restartCommunicationScheduler(
  options = {}
) {
  await stopCommunicationScheduler({
    waitForCycle:
      normaliseBoolean(
        options.waitForCycle,
        true
      ),
  });

  return startCommunicationScheduler({
    ...options,
    force: true,
  });
}

export {
  createCommunicationSchedulerError,
  getCommunicationSchedulerConfiguration,
  getCommunicationSchedulerStatus,
  restartCommunicationScheduler,
  runCommunicationSchedulerCycle,
  startCommunicationScheduler,
  stopCommunicationScheduler,
};

export default startCommunicationScheduler;