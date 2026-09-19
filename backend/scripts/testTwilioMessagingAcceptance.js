import "dotenv/config";
import twilio from "twilio";

import {
  buildTwilioMessagingAcceptancePlan,
  runTwilioMessagingAcceptance,
} from "../src/integrations/messaging/twilioMessagingAcceptanceService.js";
import {
  getSmsDeliveryStatus,
  sendSms,
} from "../src/services/smsDeliveryService.js";
import {
  sendTwilioWhatsApp,
} from "../src/providers/whatsapp/twilioWhatsAppProvider.js";


async function getWhatsAppStatus(
  messageId
) {
  const client =
    twilio(
      process.env
        .TWILIO_ACCOUNT_SID,
      process.env
        .TWILIO_AUTH_TOKEN
    );

  const message =
    await client
      .messages(
        messageId
      )
      .fetch();

  return {
    status:
      message.status ||
      "",
  };
}

function withLiveRuntime() {
  const keys = [
    "MESSAGE_DELIVERY_MODE",
    "SMS_PROVIDER",
    "SMS_DELIVERY_ENABLED",
    "WHATSAPP_PROVIDER",
    "WHATSAPP_DELIVERY_ENABLED",
  ];
  const previous =
    Object.fromEntries(
      keys.map(
        (key) => [
          key,
          process.env[key],
        ]
      )
    );

  process.env
    .MESSAGE_DELIVERY_MODE =
    "live";
  process.env
    .SMS_PROVIDER =
    "twilio";
  process.env
    .SMS_DELIVERY_ENABLED =
    "true";
  process.env
    .WHATSAPP_PROVIDER =
    "twilio";
  process.env
    .WHATSAPP_DELIVERY_ENABLED =
    "true";

  return () => {
    for (
      const key of
      keys
    ) {
      if (
        previous[key] ===
        undefined
      ) {
        delete process.env[
          key
        ];
      } else {
        process.env[
          key
        ] =
          previous[key];
      }
    }
  };
}

async function main() {
  const plan =
    buildTwilioMessagingAcceptancePlan(
      process.env
    );
  const restore =
    withLiveRuntime();

  try {
    const result =
      await runTwilioMessagingAcceptance({
        plan,
        sendSms,
        sendWhatsApp:
          sendTwilioWhatsApp,
        lookupStatus:
          async (
            channel,
            messageId
          ) =>
            channel ===
            "sms"
              ? getSmsDeliveryStatus(
                  messageId
                )
              : getWhatsAppStatus(
                  messageId
                ),
      });

    console.log(
      JSON.stringify(
        {
          ...result,
          targets: {
            sms:
              plan.sms
                ? plan.sms.to
                    .replace(
                      /.(?=.{4})/g,
                      "*"
                    )
                : null,
            whatsapp:
              plan.whatsapp
                ? plan.whatsapp.to
                    .replace(
                      /.(?=.{4})/g,
                      "*"
                    )
                : null,
          },
        },
        null,
        2
      )
    );
  } finally {
    restore();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        success: false,
        code:
          error?.code ||
          "TWILIO_MESSAGING_ACCEPTANCE_FAILED",
        message:
          error?.message ||
          "Twilio messaging acceptance failed.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
