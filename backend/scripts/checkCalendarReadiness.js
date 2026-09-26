import "dotenv/config";
import mongoose from "mongoose";

import ExternalCalendarConnection from "../src/models/ExternalCalendarConnection.js";
import {
  providerAvailability,
} from "../src/integrations/calendar/calendarOAuthProvider.js";
import {
  buildCalendarReadinessReport,
} from "../src/integrations/calendar/calendarReadinessService.js";

async function readConnections() {
  const mongoUri =
    String(
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      ""
    ).trim();

  if (!mongoUri) {
    return {
      readable: false,
      connections: [],
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

    const connections =
      await ExternalCalendarConnection.find(
        {}
      )
        .select(
          "provider status syncEnabled calendarId subscriptionExpiresAt lastWebhookAt lastSyncedAt lastSyncError"
        )
        .lean();

    return {
      readable: true,
      connections,
    };
  } catch {
    return {
      readable: false,
      connections: [],
    };
  } finally {
    if (
      mongoose.connection
        .readyState !==
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

const inventory =
  await readConnections();

const report =
  buildCalendarReadinessReport({
    providerAvailability:
      providerAvailability(),
    connections:
      inventory.connections,
    databaseReadable:
      inventory.readable,
  });

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);

if (
  report.readyForAcceptance !==
  true
) {
  process.exitCode = 1;
}
