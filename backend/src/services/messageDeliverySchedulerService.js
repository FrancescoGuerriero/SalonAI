import {
  processDueCampaigns,
} from "./campaignDeliveryService.js";

import {
  retryDueDeliveryRecords,
} from "./messageDeliveryRecordService.js";

const DEFAULT_INTERVAL_MS = 60000;
const MINIMUM_INTERVAL_MS = 10000;
const MAXIMUM_INTERVAL_MS = 86400000;

const DEFAULT_CAMPAIGN_LIMIT = 25;
const DEFAULT_CAMPAIGN_CONCURRENCY = 2;

const DEFAULT_RETRY_LIMIT = 100;
const DEFAULT_RETRY_CONCURRENCY = 5;

const schedulerState = {
  timer: null,
  currentCyclePromise: null,

  enabled: false,
  started: false,
  stopping: false,

  intervalMs: DEFAULT_INTERVAL_MS,
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

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue =
    normaliseText(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(normalisedValue)
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
    ].includes(normalisedValue)
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
  const number = Number(value);

  if (!Number.isFinite(number)) {
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

function parseDate(
  value,
  fallback = new Date()
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createSchedulerError(
      "The scheduler cycle date is invalid.",
      {
        statusCode: 400,
        code:
          "INVALID_SCHEDULER_CYCLE_DATE",
      }
    );
  }

  return date;
}

function serialiseError(error) {
  if (!error) {
    return null;
  }

  return {
    message:
      error.message ||
      "Message-delivery scheduler error.",

    code:
      error.code ||
      "MESSAGE_DELIVERY_SCHEDULER_ERROR",

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

function createSchedulerError(
  message,
  {
    statusCode = 500,
    code =
      "MESSAGE_DELIVERY_SCHEDULER_ERROR",
    cause = null,
    details = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.details = details;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function getSchedulerConfiguration(
  overrides = {}
) {
  return {
    enabled:
      overrides.enabled ??
      normaliseBoolean(
        process.env
          .MESSAGE_DELIVERY_SCHEDULER_ENABLED,
        false
      ),

    intervalMs:
      normaliseInteger(
        overrides.intervalMs ??
          process.env
            .MESSAGE_DELIVERY_SCHEDULER_INTERVAL_MS,
        DEFAULT_INTERVAL_MS,
        MINIMUM_INTERVAL_MS,
        MAXIMUM_INTERVAL_MS
      ),

    runImmediately:
      overrides.runImmediately ??
      normaliseBoolean(
        process.env
          .MESSAGE_DELIVERY_SCHEDULER_RUN_IMMEDIATELY,
        true
      ),

    unrefTimer:
      overrides.unrefTimer ??
      normaliseBoolean(
        process.env
          .MESSAGE_DELIVERY_SCHEDULER_UNREF_TIMER,
        true
      ),

    campaignLimit:
      normaliseInteger(
        overrides.campaignLimit ??
          process.env
            .CAMPAIGN_SCHEDULER_LIMIT,
        DEFAULT_CAMPAIGN_LIMIT,
        1,
        100
      ),

    campaignConcurrency:
      normaliseInteger(
        overrides
          .campaignConcurrency ??
          process.env
            .CAMPAIGN_SCHEDULER_CONCURRENCY,
        DEFAULT_CAMPAIGN_CONCURRENCY,
        1,
        10
      ),

    retryLimit:
      normaliseInteger(
        overrides.retryLimit ??
          process.env
            .MESSAGE_DELIVERY_RETRY_PROCESSING_LIMIT,
        DEFAULT_RETRY_LIMIT,
        1,
        1000
      ),

    retryConcurrency:
      normaliseInteger(
        overrides
          .retryConcurrency ??
          process.env
            .MESSAGE_DELIVERY_RETRY_CONCURRENCY,
        DEFAULT_RETRY_CONCURRENCY,
        1,
        50
      ),

    campaignDeliveryOptions: {
      batchSize:
        overrides
          .campaignDeliveryOptions
          ?.batchSize,

      delayBetweenBatchesSeconds:
        overrides
          .campaignDeliveryOptions
          ?.delayBetweenBatchesSeconds,

      concurrency:
        overrides
          .campaignDeliveryOptions
          ?.concurrency,

      maximumRecipients:
        overrides
          .campaignDeliveryOptions
          ?.maximumRecipients,

      maximumAttempts:
        overrides
          .campaignDeliveryOptions
          ?.maximumAttempts,

      retryDelayMs:
        overrides
          .campaignDeliveryOptions
          ?.retryDelayMs,

      deferRetries:
        overrides
          .campaignDeliveryOptions
          ?.deferRetries,

      consentRequired:
        overrides
          .campaignDeliveryOptions
          ?.consentRequired,

      excludeUnsubscribed:
        overrides
          .campaignDeliveryOptions
          ?.excludeUnsubscribed,
    },
  };
}

function getMessageDeliverySchedulerStatus() {
  return {
    enabled:
      schedulerState.enabled,

    started:
      schedulerState.started,

    stopping:
      schedulerState.stopping,

    runningCycle:
      Boolean(
        schedulerState
          .currentCyclePromise
      ),

    intervalMs:
      schedulerState.intervalMs,

    runImmediately:
      schedulerState.runImmediately,

    startedAt:
      schedulerState.startedAt,

    stoppedAt:
      schedulerState.stoppedAt,

    lastCycleStartedAt:
      schedulerState
        .lastCycleStartedAt,

    lastCycleCompletedAt:
      schedulerState
        .lastCycleCompletedAt,

    lastSuccessfulCycleAt:
      schedulerState
        .lastSuccessfulCycleAt,

    lastFailedCycleAt:
      schedulerState
        .lastFailedCycleAt,

    counters: {
      total:
        schedulerState
          .totalCycles,

      successful:
        schedulerState
          .successfulCycles,

      failed:
        schedulerState
          .failedCycles,

      skipped:
        schedulerState
          .skippedCycles,
    },

    lastCycle:
      schedulerState.lastCycle,

    lastError:
      schedulerState.lastError,
  };
}

function createSkippedCycleResult(
  reason
) {
  const now =
    new Date().toISOString();

  schedulerState.skippedCycles += 1;

  return {
    success: true,
    skipped: true,
    reason,
    startedAt: now,
    completedAt: now,

    campaigns: null,
    retries: null,
  };
}

async function executeSchedulerCycle({
  dueBefore,
  configuration,
  source,
  userId,
}) {
  const startedAt =
    new Date();

  schedulerState
    .lastCycleStartedAt =
    startedAt.toISOString();

  schedulerState.totalCycles += 1;

  const campaignPromise =
    processDueCampaigns({
      dueBefore,

      limit:
        configuration
          .campaignLimit,

      concurrency:
        configuration
          .campaignConcurrency,

      userId,

      deliveryOptions:
        configuration
          .campaignDeliveryOptions,
    });

  const retryPromise =
    retryDueDeliveryRecords({
      dueBefore,

      limit:
        configuration
          .retryLimit,

      concurrency:
        configuration
          .retryConcurrency,

      updatedBy: userId,
    });

  const [
    campaignOutcome,
    retryOutcome,
  ] = await Promise.allSettled([
    campaignPromise,
    retryPromise,
  ]);

  const campaigns =
    campaignOutcome.status ===
    "fulfilled"
      ? {
          success:
            campaignOutcome
              .value
              .success,

          result:
            campaignOutcome
              .value,

          error: null,
        }
      : {
          success: false,
          result: null,

          error:
            serialiseError(
              campaignOutcome.reason
            ),
        };

  const retries =
    retryOutcome.status ===
    "fulfilled"
      ? {
          success:
            retryOutcome
              .value
              .success,

          result:
            retryOutcome
              .value,

          error: null,
        }
      : {
          success: false,
          result: null,

          error:
            serialiseError(
              retryOutcome.reason
            ),
        };

  const success =
    campaigns.success &&
    retries.success;

  const completedAt =
    new Date();

  const result = {
    success,
    skipped: false,
    source,

    dueBefore:
      dueBefore.toISOString(),

    startedAt:
      startedAt.toISOString(),

    completedAt:
      completedAt.toISOString(),

    durationMs:
      completedAt.getTime() -
      startedAt.getTime(),

    campaigns,
    retries,
  };

  schedulerState
    .lastCycleCompletedAt =
    completedAt.toISOString();

  schedulerState.lastCycle =
    result;

  if (success) {
    schedulerState
      .successfulCycles += 1;

    schedulerState
      .lastSuccessfulCycleAt =
      completedAt.toISOString();

    schedulerState.lastError =
      null;
  } else {
    schedulerState
      .failedCycles += 1;

    schedulerState
      .lastFailedCycleAt =
      completedAt.toISOString();

    schedulerState.lastError = {
      message:
        "One or more scheduler operations failed.",

      code:
        "SCHEDULER_CYCLE_PARTIAL_FAILURE",

      campaigns:
        campaigns.error,

      retries:
        retries.error,
    };
  }

  return result;
}

async function runMessageDeliverySchedulerCycle(
  options = {}
) {
  const configuration =
    getSchedulerConfiguration(
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
    return createSkippedCycleResult(
      "The message-delivery scheduler is disabled."
    );
  }

  if (
    schedulerState
      .currentCyclePromise
  ) {
    return createSkippedCycleResult(
      "A message-delivery scheduler cycle is already running."
    );
  }

  if (
    schedulerState.stopping
  ) {
    return createSkippedCycleResult(
      "The message-delivery scheduler is stopping."
    );
  }

  const dueBefore =
    parseDate(
      options.dueBefore,
      new Date()
    );

  const source =
    normaliseText(
      options.source
    ) || "scheduler";

  const userId =
    options.userId || null;

  const cyclePromise =
    executeSchedulerCycle({
      dueBefore,
      configuration,
      source,
      userId,
    });

  schedulerState
    .currentCyclePromise =
    cyclePromise;

  try {
    return await cyclePromise;
  } catch (error) {
    const completedAt =
      new Date().toISOString();

    schedulerState
      .failedCycles += 1;

    schedulerState
      .lastCycleCompletedAt =
      completedAt;

    schedulerState
      .lastFailedCycleAt =
      completedAt;

    schedulerState.lastError =
      serialiseError(error);

    const result = {
      success: false,
      skipped: false,
      source,

      dueBefore:
        dueBefore.toISOString(),

      startedAt:
        schedulerState
          .lastCycleStartedAt,

      completedAt,

      campaigns: null,
      retries: null,

      error:
        serialiseError(error),
    };

    schedulerState.lastCycle =
      result;

    return result;
  } finally {
    schedulerState
      .currentCyclePromise =
      null;
  }
}

function scheduleNextCycles(
  configuration
) {
  const timer = setInterval(
    () => {
      void runMessageDeliverySchedulerCycle(
        {
          ...configuration,
          enabled: true,
          source: "interval",
        }
      ).catch((error) => {
        console.error(
          "Message-delivery scheduler cycle failed:",
          error
        );
      });
    },
    configuration.intervalMs
  );

  if (
    configuration.unrefTimer &&
    typeof timer.unref ===
      "function"
  ) {
    timer.unref();
  }

  return timer;
}

async function startMessageDeliveryScheduler(
  options = {}
) {
  const configuration =
    getSchedulerConfiguration(
      options
    );

  const force =
    normaliseBoolean(
      options.force,
      false
    );

  if (
    schedulerState.started &&
    schedulerState.timer
  ) {
    return {
      success: true,
      started: false,
      alreadyRunning: true,

      message:
        "The message-delivery scheduler is already running.",

      scheduler:
        getMessageDeliverySchedulerStatus(),
    };
  }

  if (
    !configuration.enabled &&
    !force
  ) {
    schedulerState.enabled =
      false;

    return {
      success: true,
      started: false,
      alreadyRunning: false,

      message:
        "The message-delivery scheduler is disabled.",

      scheduler:
        getMessageDeliverySchedulerStatus(),
    };
  }

  schedulerState.enabled =
    true;

  schedulerState.started =
    true;

  schedulerState.stopping =
    false;

  schedulerState.intervalMs =
    configuration.intervalMs;

  schedulerState.runImmediately =
    configuration.runImmediately;

  schedulerState.startedAt =
    new Date().toISOString();

  schedulerState.stoppedAt =
    null;

  schedulerState.timer =
    scheduleNextCycles(
      configuration
    );

  let initialCycle = null;

  if (
    configuration.runImmediately
  ) {
    initialCycle =
      await runMessageDeliverySchedulerCycle(
        {
          ...configuration,
          enabled: true,
          source: "startup",
        }
      );
  }

  return {
    success: true,
    started: true,
    alreadyRunning: false,

    message:
      "Message-delivery scheduler started successfully.",

    initialCycle,

    scheduler:
      getMessageDeliverySchedulerStatus(),
  };
}

async function stopMessageDeliveryScheduler(
  {
    waitForCycle = true,
  } = {}
) {
  schedulerState.stopping =
    true;

  if (schedulerState.timer) {
    clearInterval(
      schedulerState.timer
    );

    schedulerState.timer =
      null;
  }

  if (
    waitForCycle &&
    schedulerState
      .currentCyclePromise
  ) {
    try {
      await schedulerState
        .currentCyclePromise;
    } catch (error) {
      schedulerState.lastError =
        serialiseError(error);
    }
  }

  schedulerState.started =
    false;

  schedulerState.enabled =
    false;

  schedulerState.stopping =
    false;

  schedulerState.stoppedAt =
    new Date().toISOString();

  return {
    success: true,

    message:
      "Message-delivery scheduler stopped successfully.",

    scheduler:
      getMessageDeliverySchedulerStatus(),
  };
}

async function restartMessageDeliveryScheduler(
  options = {}
) {
  await stopMessageDeliveryScheduler({
    waitForCycle:
      normaliseBoolean(
        options.waitForCycle,
        true
      ),
  });

  return startMessageDeliveryScheduler({
    ...options,
    force: true,
  });
}

export {
  createSchedulerError,
  getMessageDeliverySchedulerStatus,
  getSchedulerConfiguration,
  restartMessageDeliveryScheduler,
  runMessageDeliverySchedulerCycle,
  startMessageDeliveryScheduler,
  stopMessageDeliveryScheduler,
};

export default startMessageDeliveryScheduler;