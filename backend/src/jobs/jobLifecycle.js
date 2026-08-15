import mongoose from "mongoose";
import {
  getAppointmentReminderJobStatus,
  startAppointmentReminderJob,
  stopAppointmentReminderJob,
} from "./appointmentReminderJob.js";

let startPromise = null;
let disconnectHookRegistered = false;

async function stopReminderJob() {
  const status = getAppointmentReminderJobStatus();

  if (!status.started && !status.runningCycle) {
    return null;
  }

  return stopAppointmentReminderJob({
    waitForCycle: true,
  });
}

function registerDisconnectHook() {
  if (disconnectHookRegistered) {
    return;
  }

  disconnectHookRegistered = true;

  mongoose.connection.on("disconnected", () => {
    void stopReminderJob().catch((error) => {
      console.error(
        "Appointment reminder shutdown failed:",
        error
      );
    });
  });
}

export async function startDatabaseJobs() {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    registerDisconnectHook();

    const appointmentReminders =
      await startAppointmentReminderJob();

    return {
      success: true,
      appointmentReminders,
    };
  })();

  try {
    return await startPromise;
  } catch (error) {
    startPromise = null;
    throw error;
  }
}

export async function stopDatabaseJobs() {
  const appointmentReminders =
    await stopReminderJob();

  startPromise = null;

  return {
    success: true,
    appointmentReminders,
  };
}

export function getDatabaseJobStatus() {
  return {
    appointmentReminders:
      getAppointmentReminderJobStatus(),
  };
}
