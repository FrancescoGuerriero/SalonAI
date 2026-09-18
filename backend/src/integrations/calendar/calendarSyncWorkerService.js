import {
  processCalendarSyncBatch,
} from "./calendarSyncOutboxService.js";
import {
  reconcileAllEnabledCalendars,
} from "./calendarInboundReconciliationService.js";

const DEFAULT_INTERVAL_MS =
  30_000;
const DEFAULT_BATCH_SIZE =
  25;
const DEFAULT_INBOUND_INTERVAL_MS =
  120_000;

let timer = null;
let runningCycle = null;
let startedAt = null;
let lastSuccessfulCycleAt =
  null;
let lastFailedCycleAt =
  null;
let lastError = "";
let lastInboundCycleAt =
  null;
let lastInboundResult =
  null;

function enabled() {
  return [
    "1",
    "true",
    "yes",
    "on",
    "enabled",
  ].includes(
    String(
      process.env
        .CALENDAR_SYNC_WORKER_ENABLED ||
        ""
    )
      .trim()
      .toLowerCase()
  );
}

function integer(
  value,
  fallback,
  min,
  max
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  return (
    Number.isFinite(
      parsed
    ) &&
    parsed >= min &&
    parsed <= max
  )
    ? parsed
    : fallback;
}

function intervalMs() {
  return integer(
    process.env
      .CALENDAR_SYNC_WORKER_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    5_000,
    15 * 60 * 1000
  );
}

function inboundIntervalMs() {
  return integer(
    process.env
      .CALENDAR_SYNC_INBOUND_INTERVAL_MS,
    DEFAULT_INBOUND_INTERVAL_MS,
    30_000,
    60 * 60 * 1000
  );
}

function inboundDue() {
  return (
    !lastInboundCycleAt ||
    Date.now() -
        lastInboundCycleAt.getTime() >=
      inboundIntervalMs()
  );
}

function batchSize() {
  return integer(
    process.env
      .CALENDAR_SYNC_WORKER_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    1,
    100
  );
}

async function cycle() {
  if (runningCycle) {
    return runningCycle;
  }

  runningCycle =
    (async () => {
      try {
        const outbound =
          await processCalendarSyncBatch({
            limit:
              batchSize(),
          });

        let inbound =
          null;

        if (inboundDue()) {
          inbound =
            await reconcileAllEnabledCalendars({
              limit:
                batchSize(),
            });
          lastInboundCycleAt =
            new Date();
          lastInboundResult =
            inbound;
        }

        const result = {
          outbound,
          inbound,
        };

        lastSuccessfulCycleAt =
          new Date();
        lastError = "";
        return result;
      } catch (error) {
        lastFailedCycleAt =
          new Date();
        lastError =
          String(
            error?.message ||
              "Calendar sync worker failed."
          );
        throw error;
      } finally {
        runningCycle =
          null;
      }
    })();

  return runningCycle;
}

function schedule() {
  if (!timer) {
    return;
  }

  timer =
    setTimeout(
      async () => {
        try {
          await cycle();
        } catch (error) {
          console.error(
            "Calendar sync worker cycle failed:",
            error
          );
        }

        schedule();
      },
      intervalMs()
    );

  timer.unref?.();
}

export async function startCalendarSyncWorker() {
  if (!enabled()) {
    return {
      started: false,
      message:
        "Calendar synchronization worker is disabled.",
    };
  }

  if (timer) {
    return {
      started: true,
      alreadyStarted: true,
      worker:
        getCalendarSyncWorkerStatus(),
    };
  }

  startedAt =
    new Date();

  // A placeholder handle marks the worker started before the
  // initial cycle, preventing concurrent double-starts.
  timer =
    setTimeout(
      () => undefined,
      2_147_483_647
    );
  timer.unref?.();

  let initialCycle;

  try {
    initialCycle =
      await cycle();
  } finally {
    clearTimeout(timer);
    timer = {};
  }

  schedule();

  return {
    started: true,
    initialCycle,
    worker:
      getCalendarSyncWorkerStatus(),
  };
}

export async function stopCalendarSyncWorker({
  waitForCycle = true,
} = {}) {
  if (timer) {
    if (
      typeof timer ===
      "object" &&
      typeof timer.hasRef ===
        "function"
    ) {
      clearTimeout(timer);
    }
    timer = null;
  }

  if (
    waitForCycle &&
    runningCycle
  ) {
    await runningCycle.catch(
      () => undefined
    );
  }

  return {
    stopped: true,
  };
}

export function getCalendarSyncWorkerStatus() {
  return {
    enabled:
      enabled(),
    started:
      Boolean(timer),
    runningCycle:
      Boolean(
        runningCycle
      ),
    intervalMs:
      intervalMs(),
    batchSize:
      batchSize(),
    inboundIntervalMs:
      inboundIntervalMs(),
    lastInboundCycleAt,
    lastInboundResult,
    startedAt,
    lastSuccessfulCycleAt,
    lastFailedCycleAt,
    lastError,
  };
}
