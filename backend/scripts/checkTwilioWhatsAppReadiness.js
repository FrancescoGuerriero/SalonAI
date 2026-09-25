import "dotenv/config";

import mongoose from "mongoose";
import twilio from "twilio";

import {
  buildTwilioWhatsAppOperationalReadinessReport,
} from "../src/integrations/messaging/twilioWhatsAppReadinessService.js";
import {
  isFeatureEnabled,
} from "../src/services/featureControlService.js";

async function readFeatureControls() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;

  if (!uri) {
    return {
      readable: false,
      whatsappBooking:
        false,
      consultation:
        false,
    };
  }

  try {
    await mongoose.connect(
      uri,
      {
        serverSelectionTimeoutMS:
          15000,
      }
    );

    const [
      whatsappBooking,
      consultation,
    ] =
      await Promise.all([
        isFeatureEnabled(
          "whatsapp-booking"
        ),
        isFeatureEnabled(
          "consultation"
        ),
      ]);

    return {
      readable: true,
      whatsappBooking,
      consultation,
    };
  } catch {
    return {
      readable: false,
      whatsappBooking:
        false,
      consultation:
        false,
    };
  } finally {
    if (
      mongoose.connection
        .readyState !==
      0
    ) {
      await mongoose.disconnect();
    }
  }
}

async function probeTwilioAccount() {
  const accountSid =
    String(
      process.env
        .TWILIO_ACCOUNT_SID ||
        ""
    ).trim();

  const authToken =
    String(
      process.env
        .TWILIO_AUTH_TOKEN ||
        ""
    ).trim();

  const client =
    twilio(
      accountSid,
      authToken
    );

  const account =
    await client
      .api
      .accounts(
        accountSid
      )
      .fetch();

  return {
    status:
      account.status ||
      "",
  };
}

const featureControls =
  await readFeatureControls();

const report =
  await buildTwilioWhatsAppOperationalReadinessReport({
    featureControlsReadable:
      featureControls.readable,
    whatsappBookingFeatureEnabled:
      featureControls.whatsappBooking,
    consultationFeatureEnabled:
      featureControls.consultation,
    probeAccount:
      probeTwilioAccount,
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
