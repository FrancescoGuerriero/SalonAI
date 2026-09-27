import "dotenv/config";
import mongoose from "mongoose";

import CommunicationCampaign from "../src/models/CommunicationCampaign.js";
import MessageDelivery from "../src/models/MessageDelivery.js";
import {
  getSchedulerConfiguration,
} from "../src/services/messageDeliverySchedulerService.js";
import {
  getAppointmentReminderConfiguration,
} from "../src/jobs/appointmentReminderJob.js";
import {
  buildCommunicationSchedulerReadinessReport,
} from "../src/services/communicationSchedulerReadinessService.js";

async function readInventory(now = new Date()) {
  const mongoUri =
    String(
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      ""
    ).trim();

  if (!mongoUri) {
    return {
      readable: false,
      inventory: {},
    };
  }

  try {
    await mongoose.connect(
      mongoUri,
      {
        serverSelectionTimeoutMS:
          15_000,
        autoIndex: false,
        autoCreate: false,
      }
    );

    const retryableBase = {
      status: {
        $in: [
          "failed",
          "undelivered",
        ],
      },
      "retry.retryable": true,
      $expr: {
        $lt: [
          "$attemptCount",
          "$maximumAttempts",
        ],
      },
    };

    const [
      scheduledCampaignsDue,
      scheduledCampaignsFuture,
      retryableDeliveriesDue,
      retryableDeliveriesFuture,
      processingDeliveries,
      failedOrUndelivered,
      pendingDeliveries,
    ] = await Promise.all([
      CommunicationCampaign.countDocuments({
        status: "scheduled",
        "schedule.mode": "scheduled",
        "schedule.scheduledAt": {
          $lte: now,
        },
      }),
      CommunicationCampaign.countDocuments({
        status: "scheduled",
        "schedule.mode": "scheduled",
        "schedule.scheduledAt": {
          $gt: now,
        },
      }),
      MessageDelivery.countDocuments({
        ...retryableBase,
        "retry.nextRetryAt": {
          $lte: now,
        },
      }),
      MessageDelivery.countDocuments({
        ...retryableBase,
        "retry.nextRetryAt": {
          $gt: now,
        },
      }),
      MessageDelivery.countDocuments({
        status: "processing",
      }),
      MessageDelivery.countDocuments({
        status: {
          $in: [
            "failed",
            "undelivered",
          ],
        },
      }),
      MessageDelivery.countDocuments({
        status: "pending",
      }),
    ]);

    return {
      readable: true,
      inventory: {
        scheduledCampaignsDue,
        scheduledCampaignsFuture,
        retryableDeliveriesDue,
        retryableDeliveriesFuture,
        processingDeliveries,
        failedOrUndelivered,
        pendingDeliveries,
      },
    };
  } catch {
    return {
      readable: false,
      inventory: {},
    };
  } finally {
    if (
      mongoose.connection.readyState !==
      0
    ) {
      await mongoose
        .disconnect()
        .catch(
          () => undefined
        );
    }
  }
}

const state =
  await readInventory();

const report =
  buildCommunicationSchedulerReadinessReport({
    databaseReadable:
      state.readable,
    schedulerConfiguration:
      getSchedulerConfiguration(),
    reminderConfiguration:
      getAppointmentReminderConfiguration(),
    inventory:
      state.inventory,
  });

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);

if (
  report.readyForActivation !==
  true
) {
  process.exitCode = 1;
}
