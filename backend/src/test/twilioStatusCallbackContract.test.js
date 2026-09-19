import assert from "node:assert/strict";
import test from "node:test";

import {
  getMessageDeliveryConfig,
  getSafeMessageDeliveryConfig,
  getTwilioMessagingStatusCallbackReadiness,
  resolveTwilioMessagingStatusCallback,
  validateMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  getExpectedWebhookUrl,
} from "../middleware/twilioWebhookMiddleware.js";

const ENVIRONMENT_MISSING =
  Symbol("environment-missing");

async function withEnvironment(
  overrides,
  callback
) {
  const previous =
    new Map();

  for (
    const [
      key,
      value,
    ] of Object.entries(
      overrides
    )
  ) {
    previous.set(
      key,
      Object.prototype
        .hasOwnProperty.call(
          process.env,
          key
        )
        ? process.env[key]
        : ENVIRONMENT_MISSING
    );

    if (
      value === null ||
      value === undefined
    ) {
      delete process.env[
        key
      ];
    } else {
      process.env[key] =
        String(value);
    }
  }

  try {
    return await callback();
  } finally {
    for (
      const [
        key,
        value,
      ] of previous
    ) {
      if (
        value ===
        ENVIRONMENT_MISSING
      ) {
        delete process.env[
          key
        ];
      } else {
        process.env[key] =
          value;
      }
    }
  }
}

test(
  "canonical Twilio messaging callback overrides legacy channel aliases",
  () => {
    const resolved =
      resolveTwilioMessagingStatusCallback({
        TWILIO_MESSAGING_STATUS_CALLBACK_URL:
          "https://api.example.com/api/message-delivery/webhooks/twilio/status",
        TWILIO_STATUS_CALLBACK_URL:
          "https://old.example.com/sms",
        TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
          "https://old.example.com/whatsapp",
      });

    assert.equal(
      resolved.url,
      "https://api.example.com/api/message-delivery/webhooks/twilio/status"
    );
    assert.equal(
      resolved.source,
      "TWILIO_MESSAGING_STATUS_CALLBACK_URL"
    );
    assert.equal(
      resolved.legacyConflict,
      false
    );
  }
);

test(
  "matching legacy callback aliases remain backwards compatible",
  () => {
    const url =
      "https://api.example.com/api/message-delivery/webhooks/twilio/status";

    const resolved =
      resolveTwilioMessagingStatusCallback({
        TWILIO_STATUS_CALLBACK_URL:
          url,
        TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
          url,
      });

    assert.equal(
      resolved.url,
      url
    );
    assert.equal(
      resolved.source,
      "TWILIO_STATUS_CALLBACK_URL"
    );
    assert.equal(
      resolved.legacyConflict,
      false
    );
  }
);

test(
  "conflicting legacy SMS and WhatsApp callbacks fail closed",
  () => {
    const environment = {
      TWILIO_STATUS_CALLBACK_URL:
        "https://api.example.com/sms-status",
      TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
        "https://api.example.com/whatsapp-status",
    };

    const resolved =
      resolveTwilioMessagingStatusCallback(
        environment
      );

    const readiness =
      getTwilioMessagingStatusCallbackReadiness(
        environment
      );

    assert.equal(
      resolved.url,
      ""
    );
    assert.equal(
      resolved.legacyConflict,
      true
    );
    assert.equal(
      readiness.ready,
      false
    );
    assert.ok(
      readiness.blockers.includes(
        "noLegacyConflict"
      )
    );
  }
);

test(
  "Twilio webhook base URL derives the shared status endpoint",
  () => {
    const resolved =
      resolveTwilioMessagingStatusCallback({
        TWILIO_WEBHOOK_BASE_URL:
          "https://api.example.com/",
      });

    assert.equal(
      resolved.url,
      "https://api.example.com/api/message-delivery/webhooks/twilio/status"
    );
    assert.equal(
      resolved.derivedFromBaseUrl,
      true
    );
  }
);

test(
  "live SMS validation requires one unambiguous HTTPS callback",
  async () => {
    await withEnvironment(
      {
        MESSAGE_DELIVERY_MODE:
          "live",
        EMAIL_DELIVERY_ENABLED:
          "false",
        SMS_DELIVERY_ENABLED:
          "true",
        SMS_PROVIDER:
          "twilio",
        TWILIO_ACCOUNT_SID:
          "AC_test",
        TWILIO_AUTH_TOKEN:
          "secret",
        TWILIO_FROM_NUMBER:
          "+442000000001",
        TWILIO_MESSAGING_STATUS_CALLBACK_URL:
          null,
        TWILIO_STATUS_CALLBACK_URL:
          null,
        TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
          null,
        TWILIO_WEBHOOK_BASE_URL:
          null,
      },
      async () => {
        const invalid =
          validateMessageDeliveryConfig(
            getMessageDeliveryConfig(),
            {
              throwOnError:
                false,
            }
          );

        assert.equal(
          invalid.channels
            .sms.valid,
          false
        );
        assert.ok(
          invalid.channels
            .sms.errors
            .some(
              (message) =>
                /status callback/i.test(
                  message
                )
            )
        );

        process.env
          .TWILIO_MESSAGING_STATUS_CALLBACK_URL =
          "https://api.example.com/api/message-delivery/webhooks/twilio/status";

        const valid =
          validateMessageDeliveryConfig(
            getMessageDeliveryConfig(),
            {
              throwOnError:
                false,
            }
          );

        assert.equal(
          valid.channels
            .sms.valid,
          true
        );

        const safe =
          getSafeMessageDeliveryConfig();

        assert.equal(
          safe.sms.twilio
            .statusCallbackReadiness
            .ready,
          true
        );
      }
    );
  }
);

test(
  "signature middleware uses the same canonical URL as outbound messaging",
  async () => {
    await withEnvironment(
      {
        TWILIO_MESSAGING_STATUS_CALLBACK_URL:
          "https://api.example.com/api/message-delivery/webhooks/twilio/status",
        TWILIO_STATUS_CALLBACK_URL:
          "https://old.example.com/sms",
        TWILIO_WHATSAPP_STATUS_CALLBACK_URL:
          "https://old.example.com/whatsapp",
      },
      async () => {
        const expected =
          getExpectedWebhookUrl({
            headers: {
              host:
                "internal:5000",
            },
            originalUrl:
              "/api/message-delivery/webhooks/twilio/status",
            protocol:
              "http",
          });

        assert.equal(
          expected,
          "https://api.example.com/api/message-delivery/webhooks/twilio/status"
        );
      }
    );
  }
);
