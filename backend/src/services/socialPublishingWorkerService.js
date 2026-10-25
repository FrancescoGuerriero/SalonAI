import SocialPublication from "../features/campaigns/SocialPublication.js";
import { publishSocialPublication } from "../features/campaigns/socialPublishingService.js";

const DEFAULT_INTERVAL_MS = 60000;
const MIN_INTERVAL_MS = 30000;
const MAX_INTERVAL_MS = 3600000;
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
  return ["true", "1", "yes", "on", "enabled"].includes(
    String(value).trim().toLowerCase()
  );
}

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.floor(number)))
    : fallback;
}

function configuration(overrides = {}) {
  return {
    enabled:
      overrides.enabled ?? bool(process.env.SOCIAL_PUBLISHING_WORKER_ENABLED, false),
    intervalMs: integer(
      overrides.intervalMs ?? process.env.SOCIAL_PUBLISHING_WORKER_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS
    ),
    runImmediately:
      overrides.runImmediately ??
      bool(process.env.SOCIAL_PUBLISHING_WORKER_RUN_IMMEDIATELY, false),
    unrefTimer:
      overrides.unrefTimer ??
      bool(process.env.SOCIAL_PUBLISHING_WORKER_UNREF_TIMER, true),
    limit: integer(
      overrides.limit ?? process.env.SOCIAL_PUBLISHING_WORKER_LIMIT,
      DEFAULT_LIMIT,
      1,
      100
    ),
    concurrency: integer(
      overrides.concurrency ?? process.env.SOCIAL_PUBLISHING_WORKER_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      1,
      10
    ),
  };
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
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function processPublication(publication) {
  try {
    if (!publication.location) {
      return {
        publicationId: String(publication._id),
        success: false,
        error: {
          code: "SOCIAL_PUBLICATION_LOCATION_REQUIRED",
          message: "Legacy social publication has no authoritative location and cannot be executed automatically.",
        },
      };
    }
    const result = await publishSocialPublication(
      publication.campaign,
      publication._id,
      {
        businessId: publication.business,
        locationId: publication.location,
        actorUser: null,
      }
    );
    return {
      publicationId: String(publication._id),
      success: true,
      result,
    };
  } catch (error) {
    return {
      publicationId: String(publication._id),
      success: false,
      error: {
        code: error?.code || "SOCIAL_PUBLICATION_FAILED",
        message: error?.message || "Social publication failed.",
      },
    };
  }
}

export function getSocialPublishingWorkerStatus() {
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

export async function runSocialPublishingWorkerCycle(options = {}) {
  const config = configuration(options);
  const force = bool(options.force, false);
  if (!config.enabled && !force) {
    state.skippedCycles += 1;
    return {
      success: true,
      skipped: true,
      reason: "Social publishing worker is disabled.",
    };
  }
  if (state.currentCyclePromise) {
    state.skippedCycles += 1;
    return {
      success: true,
      skipped: true,
      reason: "A social publishing cycle is already running.",
    };
  }
  if (state.stopping) {
    state.skippedCycles += 1;
    return {
      success: true,
      skipped: true,
      reason: "Social publishing worker is stopping.",
    };
  }

  const cyclePromise = (async () => {
    const now = options.now ? new Date(options.now) : new Date();
    state.cycles += 1;
    state.lastCycleStartedAt = now.toISOString();

    const publications = await SocialPublication.find({
      status: { $in: ["queued", "scheduled"] },
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: now } },
      ],
    })
      .sort({ scheduledFor: 1, createdAt: 1, _id: 1 })
      .limit(config.limit);

    const results = await executeWithConcurrency(
      publications,
      config.concurrency,
      processPublication
    );
    const failed = results.filter((result) => !result.success).length;
    const completedAt = new Date();
    const cycle = {
      success: failed === 0,
      skipped: false,
      duePublications: publications.length,
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
      state.lastError = null;
    } else {
      state.failedCycles += 1;
      state.lastError = {
        code: "SOCIAL_PUBLISHING_CYCLE_PARTIAL_FAILURE",
        failed,
      };
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

export async function startSocialPublishingWorker(options = {}) {
  const config = configuration(options);
  if (state.started && state.timer) {
    return {
      success: true,
      started: false,
      alreadyRunning: true,
      worker: getSocialPublishingWorkerStatus(),
    };
  }
  if (!config.enabled && !bool(options.force, false)) {
    state.enabled = false;
    return {
      success: true,
      started: false,
      alreadyRunning: false,
      message: "Social publishing worker is disabled.",
      worker: getSocialPublishingWorkerStatus(),
    };
  }

  state.enabled = true;
  state.started = true;
  state.stopping = false;
  state.intervalMs = config.intervalMs;
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  state.timer = setInterval(() => {
    void runSocialPublishingWorkerCycle({ ...config, enabled: true }).catch((error) => {
      state.lastError = {
        code: error?.code || "SOCIAL_PUBLISHING_WORKER_ERROR",
        message: error?.message || String(error),
      };
    });
  }, config.intervalMs);
  if (config.unrefTimer && typeof state.timer.unref === "function") {
    state.timer.unref();
  }
  if (config.runImmediately) {
    void runSocialPublishingWorkerCycle({ ...config, enabled: true }).catch((error) => {
      state.lastError = {
        code: error?.code || "SOCIAL_PUBLISHING_WORKER_ERROR",
        message: error?.message || String(error),
      };
    });
  }

  return {
    success: true,
    started: true,
    alreadyRunning: false,
    worker: getSocialPublishingWorkerStatus(),
  };
}

export async function stopSocialPublishingWorker() {
  state.stopping = true;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (state.currentCyclePromise) {
    try {
      await state.currentCyclePromise;
    } catch {
      // Cycle state already records the failure.
    }
  }
  state.enabled = false;
  state.started = false;
  state.stopping = false;
  state.stoppedAt = new Date().toISOString();
  return getSocialPublishingWorkerStatus();
}

export default {
  getSocialPublishingWorkerStatus,
  runSocialPublishingWorkerCycle,
  startSocialPublishingWorker,
  stopSocialPublishingWorker,
};
