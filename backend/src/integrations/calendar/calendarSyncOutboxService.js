import CalendarSyncTask from "../../models/CalendarSyncTask.js";
import {
  syncAppointmentToEnabledCalendars,
} from "./calendarOutboundSyncService.js";

const MAX_ATTEMPTS = 8;
const LOCK_MS =
  5 * 60 * 1000;
const MAX_BACKOFF_MS =
  60 * 60 * 1000;

function backoffMs(
  attempts
) {
  return Math.min(
    MAX_BACKOFF_MS,
    15_000 *
      2 **
        Math.max(
          0,
          attempts - 1
        )
  );
}

async function claimTask() {
  const now =
    new Date();

  return CalendarSyncTask.findOneAndUpdate(
    {
      state: {
        $in: [
          "pending",
          "retry",
          "processing",
        ],
      },
      dueAt: {
        $lte: now,
      },
      $or: [
        {
          lockExpiresAt:
            null,
        },
        {
          lockExpiresAt: {
            $lte: now,
          },
        },
      ],
    },
    {
      $set: {
        state:
          "processing",
        lockedAt: now,
        lockExpiresAt:
          new Date(
            now.getTime() +
              LOCK_MS
          ),
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      sort: {
        dueAt: 1,
        updatedAt: 1,
      },
      new: true,
    }
  );
}

async function completeTask(
  task,
  result
) {
  const latest =
    await CalendarSyncTask.findById(
      task._id
    );

  if (!latest) {
    return null;
  }

  if (
    latest.requestedRevision >
    task.requestedRevision
  ) {
    latest.state =
      "pending";
    latest.dueAt =
      new Date();
    latest.lockedAt =
      null;
    latest.lockExpiresAt =
      null;
    latest.lastResult =
      result;
    latest.lastError =
      "";
    await latest.save();
    return latest;
  }

  latest.state =
    "completed";
  latest.processedRevision =
    task.requestedRevision;
  latest.completedAt =
    new Date();
  latest.lockedAt = null;
  latest.lockExpiresAt =
    null;
  latest.lastError = "";
  latest.lastResult =
    result;
  await latest.save();

  return latest;
}

async function failTask(
  task,
  error
) {
  const latest =
    await CalendarSyncTask.findById(
      task._id
    );

  if (!latest) {
    return null;
  }

  const message =
    String(
      error?.message ||
        "Calendar synchronization failed."
    ).slice(0, 2000);

  latest.lockedAt = null;
  latest.lockExpiresAt =
    null;
  latest.lastError =
    message;

  if (
    latest.attempts >=
    MAX_ATTEMPTS
  ) {
    latest.state =
      "dead";
    latest.dueAt =
      new Date();
  } else {
    latest.state =
      "retry";
    latest.dueAt =
      new Date(
        Date.now() +
          backoffMs(
            latest.attempts
          )
      );
  }

  await latest.save();
  return latest;
}

export async function processOneCalendarSyncTask() {
  const task =
    await claimTask();

  if (!task) {
    return {
      processed: false,
      reason:
        "no_due_task",
    };
  }

  try {
    const result =
      await syncAppointmentToEnabledCalendars(
        task.appointment
      );

    if (
      result.failed > 0
    ) {
      const error =
        new Error(
          `${result.failed} calendar provider synchronization operation(s) failed.`
        );
      error.code =
        "CALENDAR_SYNC_PARTIAL_FAILURE";
      error.result =
        result;
      throw error;
    }

    await completeTask(
      task,
      result
    );

    return {
      processed: true,
      success: true,
      taskId:
        String(
          task._id
        ),
      result,
    };
  } catch (error) {
    await failTask(
      task,
      error
    );

    return {
      processed: true,
      success: false,
      taskId:
        String(
          task._id
        ),
      error:
        String(
          error?.message ||
            "Calendar synchronization failed."
        ),
    };
  }
}

export async function processCalendarSyncBatch({
  limit = 25,
} = {}) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(limit) ||
          25
      )
    );
  const results = [];

  for (
    let index = 0;
    index < safeLimit;
    index += 1
  ) {
    const result =
      await processOneCalendarSyncTask();

    if (!result.processed) {
      break;
    }

    results.push(result);
  }

  return {
    processed:
      results.length,
    succeeded:
      results.filter(
        (item) =>
          item.success
      ).length,
    failed:
      results.filter(
        (item) =>
          !item.success
      ).length,
    results,
  };
}

export {
  MAX_ATTEMPTS,
  backoffMs,
};

export default {
  processCalendarSyncBatch,
  processOneCalendarSyncTask,
};
