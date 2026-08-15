import {
  deliverDueAppointmentReminders,
} from "../features/appointments/appointmentReminderDeliveryService.js";

const DEFAULT_INTERVAL_MS =
  30 * 60 * 1000;
const MINIMUM_INTERVAL_MS =
  60 * 1000;
const MAXIMUM_INTERVAL_MS =
  24 * 60 * 60 * 1000;
const DEFAULT_HOURS_BEFORE = 24;
const DEFAULT_LOOK_AHEAD_HOURS = 48;

const jobState = {
  timer: null,
  currentCyclePromise: null,
  enabled: false,
  started: false,
  stopping: false,
  intervalMs: DEFAULT_INTERVAL_MS,
  hoursBefore: DEFAULT_HOURS_BEFORE,
  lookAheadHours:
    DEFAULT_LOOK_AHEAD_HOURS,
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
  totalChecked: 0,
  totalDue: 0,
  totalSent: 0,
  totalSkipped: 0,
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

  if (typeof value === "boolean") {
    return value;
  }

  const normalised =
    normaliseText(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(normalised)
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
    ].includes(normalised)
  ) {
    return false;
  }

  return fallback;
}

function normaliseNumber(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  return Math.round(
    normaliseNumber(
      value,
      fallback,
      minimum,
      maximum
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
      "Appointment reminder job error.",
    code:
      error.code ||
      "APPOINTMENT_REMINDER_JOB_ERROR",
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

function createReminderJobError(
  message,
  {
    statusCode = 500,
    code =
      "APPOINTMENT_REMINDER_JOB_ERROR",
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

function getAppointmentReminderConfiguration(
  overrides = {}
) {
  return {
    enabled:
      overrides.enabled ??
      normaliseBoolean(
        process.env
          .APPOINTMENT_REMINDER_JOB_ENABLED,
        false
      ),
    intervalMs:
      normaliseInteger(
        overrides.intervalMs ??
          process.env
            .APPOINTMENT_REMINDER_JOB_INTERVAL_MS,
        DEFAULT_INTERVAL_MS,
        MINIMUM_INTERVAL_MS,
        MAXIMUM_INTERVAL_MS
      ),
    hoursBefore:
      normaliseNumber(
        overrides.hoursBefore ??
          process.env
            .APPOINTMENT_REMINDER_HOURS_BEFORE,
        DEFAULT_HOURS_BEFORE,
        0,
        8760
      ),
    lookAheadHours:
      normaliseNumber(
        overrides.lookAheadHours ??
          process.env
            .APPOINTMENT_REMINDER_LOOK_AHEAD_HOURS,
        DEFAULT_LOOK_AHEAD_HOURS,
        1,
        8760
      ),
    runImmediately:
      overrides.runImmediately ??
      normaliseBoolean(
        process.env
          .APPOINTMENT_REMINDER_JOB_RUN_IMMEDIATELY,
        true
      ),
    unrefTimer:
      overrides.unrefTimer ??
      normaliseBoolean(
        process.env
          .APPOINTMENT_REMINDER_JOB_UNREF_TIMER,
        true
      ),
  };
}

function getAppointmentReminderJobStatus() {
  return {
    enabled: jobState.enabled,
    started: jobState.started,
    stopping: jobState.stopping,
    runningCycle:
      Boolean(
        jobState.currentCyclePromise
      ),
    configuration: {
      intervalMs:
        jobState.intervalMs,
      hoursBefore:
        jobState.hoursBefore,
      lookAheadHours:
        jobState.lookAheadHours,
      channel: "customer_preference",
      runImmediately:
        jobState.runImmediately,
    },
    startedAt: jobState.startedAt,
    stoppedAt: jobState.stoppedAt,
    lastCycleStartedAt:
      jobState.lastCycleStartedAt,
    lastCycleCompletedAt:
      jobState.lastCycleCompletedAt,
    lastSuccessfulCycleAt:
      jobState.lastSuccessfulCycleAt,
    lastFailedCycleAt:
      jobState.lastFailedCycleAt,
    counters: {
      totalCycles:
        jobState.totalCycles,
      successfulCycles:
        jobState.successfulCycles,
      failedCycles:
        jobState.failedCycles,
      skippedCycles:
        jobState.skippedCycles,
      checked:
        jobState.totalChecked,
      due:
        jobState.totalDue,
      sent:
        jobState.totalSent,
      skipped:
        jobState.totalSkipped,
      failed:
        jobState.totalFailed,
    },
    lastCycle: jobState.lastCycle,
    lastError: jobState.lastError,
  };
}

function createSkippedResult(reason) {
  const timestamp =
    new Date().toISOString();

  jobState.skippedCycles += 1;

  return {
    success: true,
    skipped: true,
    reason,
    startedAt: timestamp,
    completedAt: timestamp,
    checked: 0,
    due: 0,
    sent: 0,
    skippedDeliveries: 0,
    failed: 0,
    items: [],
  };
}

async function executeAppointmentReminderCycle(
  configuration,
  source
) {
  const startedAt = new Date();

  jobState.lastCycleStartedAt =
    startedAt.toISOString();
  jobState.totalCycles += 1;

  try {
    const delivery =
      await deliverDueAppointmentReminders({
        now: startedAt,
        hoursBefore:
          configuration.hoursBefore,
        lookAheadHours:
          configuration.lookAheadHours,
      });

    const completedAt = new Date();
    const result = {
      success: delivery.success,
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
        hoursBefore:
          configuration.hoursBefore,
        lookAheadHours:
          configuration.lookAheadHours,
        channel:
          "customer_preference",
      },
      ...delivery,
    };

    jobState.lastCycleCompletedAt =
      completedAt.toISOString();
    jobState.lastCycle = result;
    jobState.totalChecked +=
      delivery.checked;
    jobState.totalDue +=
      delivery.due;
    jobState.totalSent +=
      delivery.sent;
    jobState.totalSkipped +=
      delivery.skipped;
    jobState.totalFailed +=
      delivery.failed;

    if (delivery.success) {
      jobState.successfulCycles += 1;
      jobState.lastSuccessfulCycleAt =
        completedAt.toISOString();
      jobState.lastError = null;
    } else {
      jobState.failedCycles += 1;
      jobState.lastFailedCycleAt =
        completedAt.toISOString();
      jobState.lastError = {
        message:
          "One or more appointment reminders could not be delivered.",
        code:
          "APPOINTMENT_REMINDER_PARTIAL_FAILURE",
        failed:
          delivery.failed,
      };
    }

    if (delivery.due > 0) {
      console.log(
        `SalonAI appointment reminder cycle: ${delivery.sent} sent, ${delivery.skipped} skipped, ${delivery.failed} failed.`
      );
    }

    return result;
  } catch (error) {
    const completedAt = new Date();

    jobState.failedCycles += 1;
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
      checked: 0,
      due: 0,
      sent: 0,
      skippedDeliveries: 0,
      failed: 0,
      items: [],
      error:
        serialiseError(error),
    };

    jobState.lastCycle = result;

    console.error(
      "Appointment reminder job failed:",
      error
    );

    return result;
  }
}

async function runAppointmentReminderCycle(
  options = {}
) {
  const configuration =
    getAppointmentReminderConfiguration(
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
      "The appointment reminder job is disabled."
    );
  }

  if (jobState.currentCyclePromise) {
    return createSkippedResult(
      "An appointment reminder cycle is already running."
    );
  }

  if (jobState.stopping) {
    return createSkippedResult(
      "The appointment reminder job is stopping."
    );
  }

  const source =
    normaliseText(options.source) ||
    "manual";

  const cyclePromise =
    executeAppointmentReminderCycle(
      configuration,
      source
    );

  jobState.currentCyclePromise =
    cyclePromise;

  try {
    return await cyclePromise;
  } finally {
    jobState.currentCyclePromise = null;
  }
}

function scheduleAppointmentReminderCycles(
  configuration
) {
  const timer = setInterval(
    () => {
      void runAppointmentReminderCycle({
        ...configuration,
        enabled: true,
        source: "interval",
      }).catch((error) => {
        console.error(
          "Appointment reminder interval failed:",
          error
        );
      });
    },
    configuration.intervalMs
  );

  if (
    configuration.unrefTimer &&
    typeof timer.unref === "function"
  ) {
    timer.unref();
  }

  return timer;
}

async function startAppointmentReminderJob(
  options = {}
) {
  const configuration =
    getAppointmentReminderConfiguration(
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
        "The appointment reminder job is already running.",
      job:
        getAppointmentReminderJobStatus(),
    };
  }

  if (
    !configuration.enabled &&
    !force
  ) {
    jobState.enabled = false;

    return {
      success: true,
      started: false,
      alreadyRunning: false,
      message:
        "The appointment reminder job is disabled.",
      job:
        getAppointmentReminderJobStatus(),
    };
  }

  jobState.enabled = true;
  jobState.started = true;
  jobState.stopping = false;
  jobState.intervalMs =
    configuration.intervalMs;
  jobState.hoursBefore =
    configuration.hoursBefore;
  jobState.lookAheadHours =
    configuration.lookAheadHours;
  jobState.runImmediately =
    configuration.runImmediately;
  jobState.startedAt =
    new Date().toISOString();
  jobState.stoppedAt = null;
  jobState.timer =
    scheduleAppointmentReminderCycles(
      configuration
    );

  let initialCycle = null;

  if (configuration.runImmediately) {
    initialCycle =
      await runAppointmentReminderCycle({
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
      "Appointment reminder job started successfully.",
    initialCycle,
    job:
      getAppointmentReminderJobStatus(),
  };
}

async function stopAppointmentReminderJob({
  waitForCycle = true,
} = {}) {
  jobState.stopping = true;

  if (jobState.timer) {
    clearInterval(jobState.timer);
    jobState.timer = null;
  }

  if (
    waitForCycle &&
    jobState.currentCyclePromise
  ) {
    try {
      await jobState.currentCyclePromise;
    } catch (error) {
      jobState.lastError =
        serialiseError(error);
    }
  }

  jobState.started = false;
  jobState.enabled = false;
  jobState.stopping = false;
  jobState.stoppedAt =
    new Date().toISOString();

  return {
    success: true,
    message:
      "Appointment reminder job stopped successfully.",
    job:
      getAppointmentReminderJobStatus(),
  };
}

async function restartAppointmentReminderJob(
  options = {}
) {
  await stopAppointmentReminderJob({
    waitForCycle:
      normaliseBoolean(
        options.waitForCycle,
        true
      ),
  });

  return startAppointmentReminderJob({
    ...options,
    force: true,
  });
}

export {
  createReminderJobError,
  getAppointmentReminderConfiguration,
  getAppointmentReminderJobStatus,
  restartAppointmentReminderJob,
  runAppointmentReminderCycle,
  startAppointmentReminderJob,
  stopAppointmentReminderJob,
};

export default startAppointmentReminderJob;
