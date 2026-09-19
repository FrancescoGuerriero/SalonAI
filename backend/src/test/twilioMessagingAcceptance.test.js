import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  buildTwilioMessagingAcceptancePlan,
  runTwilioMessagingAcceptance,
} from "../integrations/messaging/twilioMessagingAcceptanceService.js";

function environment(
  overrides = {}
) {
  return {
    TWILIO_ACCEPTANCE_CONFIRM:
      "RUN_TWILIO_MESSAGING_ACCEPTANCE",
    TWILIO_ACCOUNT_SID:
      "AC_test",
    TWILIO_AUTH_TOKEN:
      "secret",
    TWILIO_FROM_NUMBER:
      "+442000000001",
    TWILIO_WHATSAPP_FROM:
      "+14155238886",
    TWILIO_MESSAGING_STATUS_CALLBACK_URL:
      "https://api.example.com/api/message-delivery/webhooks/twilio/status",
    TWILIO_ACCEPTANCE_SMS_TO:
      "+447700900001",
    TWILIO_ACCEPTANCE_WHATSAPP_TO:
      "+447700900002",
    ...overrides,
  };
}

test("Twilio acceptance refuses to run without exact operator confirmation", () => {
  assert.throws(
    () =>
      buildTwilioMessagingAcceptancePlan(
        environment({
          TWILIO_ACCEPTANCE_CONFIRM:
            "",
        })
      ),
    /Refusing to send real messages/
  );
});

test(
  "Twilio acceptance refuses to run without a ready signed status-callback path",
  () => {
    assert.throws(
      () =>
        buildTwilioMessagingAcceptancePlan(
          environment({
            TWILIO_MESSAGING_STATUS_CALLBACK_URL:
              "",
            TWILIO_STATUS_CALLBACK_URL:
              "",
            TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
              "",
            TWILIO_WEBHOOK_BASE_URL:
              "",
          })
        ),
      (error) => {
        assert.equal(
          error.code,
          "TWILIO_ACCEPTANCE_STATUS_CALLBACK_NOT_READY"
        );
        return true;
      }
    );
  }
);

test("Twilio acceptance plan validates channels, targets and optional content template", () => {
  const plan =
    buildTwilioMessagingAcceptancePlan(
      environment({
        TWILIO_ACCEPTANCE_CHANNELS:
          "sms,whatsapp",
        TWILIO_ACCEPTANCE_REQUIRE_DELIVERY:
          "true",
        TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_SID:
          "HX123",
        TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_VARIABLES:
          '{"1":"SalonAI"}',
      })
    );

  assert.deepEqual(
    plan.channels,
    [
      "sms",
      "whatsapp",
    ]
  );
  assert.equal(
    plan.requireDelivery,
    true
  );
  assert.equal(
    plan.sms.to,
    "+447700900001"
  );
  assert.equal(
    plan.whatsapp.contentSid,
    "HX123"
  );
  assert.deepEqual(
    plan.whatsapp
      .contentVariables,
    {
      1: "SalonAI",
    }
  );
});

test("Twilio acceptance uses injected transports and never needs customer database state", async () => {
  const calls = [];
  const plan =
    buildTwilioMessagingAcceptancePlan(
      environment({
        TWILIO_ACCEPTANCE_REQUIRE_DELIVERY:
          "false",
      })
    );

  const result =
    await runTwilioMessagingAcceptance({
      plan,
      sendSms:
        async (payload) => {
          calls.push([
            "sms",
            payload,
          ]);
          return {
            messageId:
              "SM1",
            status:
              "queued",
          };
        },
      sendWhatsApp:
        async (payload) => {
          calls.push([
            "whatsapp",
            payload,
          ]);
          return {
            messageId:
              "SM2",
            status:
              "accepted",
          };
        },
      lookupStatus:
        async () => {
          throw new Error(
            "status lookup should not be called"
          );
        },
    });

  assert.equal(
    result.success,
    true
  );
  assert.deepEqual(
    calls.map(
      ([channel]) =>
        channel
    ),
    [
      "sms",
      "whatsapp",
    ]
  );
});

test("required delivery waits for delivered/read and fails closed on provider failure", async () => {
  const plan =
    buildTwilioMessagingAcceptancePlan(
      environment({
        TWILIO_ACCEPTANCE_CHANNELS:
          "sms",
        TWILIO_ACCEPTANCE_REQUIRE_DELIVERY:
          "true",
        TWILIO_ACCEPTANCE_STATUS_TIMEOUT_MS:
          "5000",
        TWILIO_ACCEPTANCE_STATUS_POLL_MS:
          "250",
      })
    );

  let lookups = 0;

  const delivered =
    await runTwilioMessagingAcceptance({
      plan,
      sendSms:
        async () => ({
          messageId:
            "SM3",
          status:
            "queued",
        }),
      sendWhatsApp:
        async () => {
          throw new Error(
            "not used"
          );
        },
      lookupStatus:
        async () => {
          lookups += 1;
          return {
            status:
              lookups > 1
                ? "delivered"
                : "sent",
          };
        },
      sleep:
        async () =>
          undefined,
    });

  assert.equal(
    delivered.channels
      .sms
      .deliveryStatus,
    "delivered"
  );

  await assert.rejects(
    runTwilioMessagingAcceptance({
      plan,
      sendSms:
        async () => ({
          messageId:
            "SM4",
          status:
            "queued",
        }),
      sendWhatsApp:
        async () => {
          throw new Error(
            "not used"
          );
        },
      lookupStatus:
        async () => ({
          status:
            "undelivered",
        }),
      sleep:
        async () =>
          undefined,
    }),
    /failure status undelivered/
  );
});

test("acceptance confirmation is deliberately absent from the committed env template", async () => {
  const envExample =
    await readFile(
      new URL(
        "../../.env.example",
        import.meta.url
      ),
      "utf8"
    );

  assert.equal(
    /^TWILIO_ACCEPTANCE_CONFIRM=/m.test(
      envExample
    ),
    false
  );
});
