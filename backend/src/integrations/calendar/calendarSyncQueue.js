import CalendarSyncTask from "../../models/CalendarSyncTask.js";

export async function enqueueCalendarSyncTask(
  appointmentId
) {
  const now =
    new Date();

  return CalendarSyncTask.findOneAndUpdate(
    {
      appointment:
        appointmentId,
    },
    {
      $set: {
        state: "pending",
        dueAt: now,
        lockedAt: null,
        lockExpiresAt:
          null,
        completedAt: null,
        lastError: "",
      },
      $inc: {
        requestedRevision: 1,
      },
      $setOnInsert: {
        attempts: 0,
        processedRevision: 0,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert:
        true,
    }
  );
}

export default {
  enqueueCalendarSyncTask,
};
