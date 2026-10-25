import MarketingDataSource from "../models/MarketingDataSource.js";
import { runMarketingDataSource } from "../features/integrationPlatform/marketingDataCoreService.js";
import { runMarketingProviderSource } from "../features/integrationPlatform/marketingProviderRunService.js";

const DEFAULT_INTERVAL_MS = 300000;
const MIN_INTERVAL_MS = 30000;
const MAX_INTERVAL_MS = 86400000;
const DEFAULT_LIMIT = 20;
const DEFAULT_CONCURRENCY = 3;

const state = {
  enabled: false,
  started: false,
  stopping: false,
  timer: null,
  currentCyclePromise: null,
  intervalMs: DEFAULT_INTERVAL_MS,
  startedAt: null,
  stoppedAt: null,
  lastCycleStartedAt: null,
  lastCycleCompletedAt: null,
  lastSuccessfulCycleAt: null,
  lastFailedCycleAt: null,
  cycles: 0,
  successfulCycles: 0,
  failedCycles: 0,
  skippedCycles: 0,
  lastCycle: null,
  lastError: null,
};

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on", "enabled"].includes(String(value).trim().toLowerCase());
}

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function configuration(overrides = {}) {
  return {
    enabled: overrides.enabled ?? bool(process.env.MARKETING_DATA_SYNC_WORKER_ENABLED, false),
    intervalMs: integer(
      overrides.intervalMs ?? process.env.MARKETING_DATA_SYNC_WORKER_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS
    ),
    runImmediately: overrides.runImmediately ?? bool(process.env.MARKETING_DATA_SYNC_WORKER_RUN_IMMEDIATELY, false),
    unrefTimer: overrides.unrefTimer ?? bool(process.env.MARKETING_DATA_SYNC_WORKER_UNREF_TIMER, true),
    limit: integer(overrides.limit ?? process.env.MARKETING_DATA_SYNC_WORKER_LIMIT, DEFAULT_LIMIT, 1, 100),
    concurrency: integer(overrides.concurrency ?? process.env.MARKETING_DATA_SYNC_WORKER_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 10),
  };
}

function nextRunAt(cadence, from = new Date()) {
  const milliseconds = cadence === "hourly"
    ? 3600000
    : cadence === "weekly"
      ? 7 * 86400000
      : 86400000;
  return new Date(from.getTime() + milliseconds);
}

async function processSource(source, now) {
  if (!source.location) {
    return {
      sourceId: String(source._id),
      success: false,
      error: {
        message: "Scheduled marketing source has no location ownership.",
        code: "MARKETING_SOURCE_LOCATION_REQUIRED",
      },
    };
  }
  try {
    let result;
    if (source.provider === "technical_seo") {
      result = await runMarketingDataSource(
        source._id,
        { mode: "seo_scan" },
        { businessId: source.business, locationId: source.location, actor: null }
      );
    } else {
      result = await runMarketingProviderSource(
        source._id,
        { mode: source.syncMode || "incremental" },
        { businessId: source.business, locationId: source.location, actor: null }
      );
    }
    const completedAt = new Date();
    await MarketingDataSource.updateOne(
      { _id: source._id, business: source.business, location: source.location },
      {
        $set: {
          "schedule.nextRunAt": nextRunAt(source.schedule?.cadence || "daily", completedAt),
          lastSyncAt: completedAt,
        },
      }
    );
    return { sourceId: String(source._id), locationId: String(source.location), success: true, result };
  } catch (error) {
    const retryAt = new Date(now.getTime() + 15 * 60000);
    await MarketingDataSource.updateOne(
      { _id: source._id, business: source.business, location: source.location },
      { $set: { "schedule.nextRunAt": retryAt } }
    ).catch(() => undefined);
    return {
      sourceId: String(source._id),
      locationId: String(source.location),
      success: false,
      error: {
        message: error?.message || "Marketing sync failed.",
        code: error?.code || "MARKETING_SYNC_FAILED",
      },
    };
  }
}

async function executeWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export function getMarketingDataSyncWorkerStatus() {
  return {
    enabled: state.enabled,
    started: state.started,
    stopping: state.stopping,
    runningCycle: Boolean(state.currentCyclePromise),
    intervalMs: state.intervalMs,
    startedAt: state.startedAt,
    stoppedAt: state.stoppedAt,
    lastCycleStartedAt: state.lastCycleStartedAt,
    lastCycleCompletedAt: state.lastCycleCompletedAt,
    lastSuccessfulCycleAt: state.lastSuccessfulCycleAt,
    lastFailedCycleAt: state.lastFailedCycleAt,
    counters: {
      total: state.cycles,
      successful: state.successfulCycles,
      failed: state.failedCycles,
      skipped: state.skippedCycles,
    },
    lastCycle: state.lastCycle,
    lastError: state.lastError,
  };
}

export async function runMarketingDataSyncWorkerCycle(options = {}) {
  const config = configuration(options);
  const force = bool(options.force, false);
  if (!config.enabled && !force) {
    state.skippedCycles += 1;
    return { success: true, skipped: true, reason: "Marketing Data sync worker is disabled." };
  }
  if (state.currentCyclePromise) {
    state.skippedCycles += 1;
    return { success: true, skipped: true, reason: "A Marketing Data sync cycle is already running." };
  }
  if (state.stopping) {
    state.skippedCycles += 1;
    return { success: true, skipped: true, reason: "Marketing Data sync worker is stopping." };
  }

  const cyclePromise = (async () => {
    const now = options.now ? new Date(options.now) : new Date();
    state.cycles += 1;
    state.lastCycleStartedAt = now.toISOString();
    const sources = await MarketingDataSource.find({
      location: { $ne: null },
      status: "active",
      syncMode: { $in: ["scheduled", "incremental"] },
      "schedule.cadence": { $in: ["hourly", "daily", "weekly"] },
      "schedule.nextRunAt": { $ne: null, $lte: now },
      provider: { $in: ["ga4", "google_search_console", "bing_webmaster", "technical_seo"] },
    }).sort({ "schedule.nextRunAt": 1, _id: 1 }).limit(config.limit);

    const results = await executeWithConcurrency(
      sources,
      config.concurrency,
      (source) => processSource(source, now)
    );
    const failed = results.filter((result) => !result.success).length;
    const completedAt = new Date();
    const cycle = {
      success: failed === 0,
      skipped: false,
      dueSources: sources.length,
      succeeded: results.length - failed,
      failed,
      results,
      startedAt: now.toISOString(),
      completedAt: completedAt.toISOString(),
    };
    state.lastCycle = cycle;
    state.lastCycleCompletedAt = completedAt.toISOString();
    if (cycle.success) {
      state.successfulCycles += 1;
      state.lastSuccessfulCycleAt = completedAt.toISOString();
      state.lastError = null;
    } else {
      state.failedCycles += 1;
      state.lastFailedCycleAt = completedAt.toISOString();
      state.lastError = { code: "MARKETING_SYNC_CYCLE_PARTIAL_FAILURE", failed };
    }
    return cycle;
  })();

  state.currentCyclePromise = cyclePromise;
  try {
    return await cyclePromise;
  } finally {
    state.currentCyclePromise = null;
  }
}

export async function startMarketingDataSyncWorker(options = {}) {
  const config = configuration(options);
  if (state.started && state.timer) {
    return { success: true, started: false, alreadyRunning: true, worker: getMarketingDataSyncWorkerStatus() };
  }
  if (!config.enabled && !bool(options.force, false)) {
    state.enabled = false;
    return { success: true, started: false, alreadyRunning: false, message: "Marketing Data sync worker is disabled.", worker: getMarketingDataSyncWorkerStatus() };
  }

  state.enabled = true;
  state.started = true;
  state.stopping = false;
  state.intervalMs = config.intervalMs;
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  state.timer = setInterval(() => {
    void runMarketingDataSyncWorkerCycle({ ...config, enabled: true }).catch((error) => {
      state.lastError = { message: error?.message || String(error), code: error?.code || "MARKETING_SYNC_WORKER_ERROR" };
    });
  }, config.intervalMs);
  if (config.unrefTimer && typeof state.timer.unref === "function") state.timer.unref();

  let initialCycle = null;
  if (config.runImmediately) {
    initialCycle = await runMarketingDataSyncWorkerCycle({ ...config, enabled: true });
  }
  return { success: true, started: true, alreadyRunning: false, worker: getMarketingDataSyncWorkerStatus(), initialCycle };
}

export async function stopMarketingDataSyncWorker({ waitForCycle = true } = {}) {
  state.stopping = true;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (waitForCycle && state.currentCyclePromise) await state.currentCyclePromise.catch(() => undefined);
  state.enabled = false;
  state.started = false;
  state.stopping = false;
  state.stoppedAt = new Date().toISOString();
  return { success: true, stopped: true, worker: getMarketingDataSyncWorkerStatus() };
}

export default {
  getMarketingDataSyncWorkerStatus,
  runMarketingDataSyncWorkerCycle,
  startMarketingDataSyncWorker,
  stopMarketingDataSyncWorker,
};
