import assert from "node:assert/strict";
import {
  spawnSync,
} from "node:child_process";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

import {
  getMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  sendSms as sendLegacySms,
} from "../providers/smsProvider.js";

const ENVIRONMENT_MISSING =
  Symbol("environment-missing");

async function withEnvironment(
  overrides,
  callback
) {
  const previousValues =
    new Map();

  for (
    const [
      key,
      value,
    ] of Object.entries(overrides)
  ) {
    previousValues.set(
      key,
      Object.prototype.hasOwnProperty.call(
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
      delete process.env[key];
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
        previousValue,
      ] of previousValues.entries()
    ) {
      if (
        previousValue ===
        ENVIRONMENT_MISSING
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
          previousValue;
      }
    }
  }
}

function productionEnvironment(
  overrides = {}
) {
  return {
    ...process.env,

    NODE_ENV: "production",

    MONGODB_URI:
      "mongodb://127.0.0.1:27017/salonai-test",

    JWT_SECRET:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

    JWT_REFRESH_SECRET:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

    FRONTEND_URL:
      "https://salonai.example",

    PAYMENT_PROVIDER_MODE:
      "console",

    EMAIL_VERIFICATION_REQUIRED:
      "false",

    MESSAGE_DELIVERY_MODE:
      "sandbox",

    EMAIL_DELIVERY_ENABLED:
      "false",

    EMAIL_PROVIDER:
      "smtp",

    EMAIL_PROVIDER_MODE:
      "",

    SMTP_HOST:
      "",

    SMTP_USER:
      "",

    SMTP_PASSWORD:
      "",

    EMAIL_FROM_ADDRESS:
      "",

    SMS_DELIVERY_ENABLED:
      "false",

    SMS_PROVIDER:
      "twilio",

    SMS_PROVIDER_MODE:
      "",

    TWILIO_ACCOUNT_SID:
      "",

    TWILIO_AUTH_TOKEN:
      "",

    TWILIO_FROM_NUMBER:
      "",

    TWILIO_SMS_FROM:
      "",

    TWILIO_MESSAGING_SERVICE_SID:
      "",

    WHATSAPP_PROVIDER:
      "console",

    WHATSAPP_PROVIDER_MODE:
      "",

    WHATSAPP_DELIVERY_ENABLED:
      "false",

    ...overrides,
  };
}

function importEnvironmentModule(
  environment
) {
  const backendDirectory =
    fileURLToPath(
      new URL(
        "../../",
        import.meta.url
      )
    );

  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'await import("./src/config/env.js");',
    ],
    {
      cwd: backendDirectory,
      env: environment,
      encoding: "utf8",
    }
  );
}

test(
  ".env.example uses the authoritative Phase 8.11C delivery contract",
  async () => {
    const envExample =
      await readFile(
        new URL(
          "../../.env.example",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      envExample,
      /^MESSAGE_DELIVERY_MODE=sandbox$/m
    );

    assert.match(
      envExample,
      /^EMAIL_PROVIDER=smtp$/m
    );

    assert.match(
      envExample,
      /^SMS_PROVIDER=twilio$/m
    );

    assert.doesNotMatch(
      envExample,
      /^EMAIL_PROVIDER_MODE=mock$/m
    );

    assert.doesNotMatch(
      envExample,
      /^SMS_PROVIDER_MODE=mock$/m
    );
  }
);

test(
  "legacy mock configuration normalises to the safe sandbox contract",
  async () => {
    await withEnvironment(
      {
        MESSAGE_DELIVERY_MODE:
          "mock",

        EMAIL_DELIVERY_ENABLED:
          "true",

        EMAIL_PROVIDER:
          null,

        EMAIL_PROVIDER_MODE:
          "mock",

        EMAIL_FROM_NAME:
          "SalonAI",

        EMAIL_FROM_ADDRESS:
          "info@example.com",

        EMAIL_REPLY_TO:
          "reply@example.com",

        SMTP_HOST:
          "smtp.example.com",

        SMTP_USER:
          "info@example.com",

        SMTP_PASSWORD:
          "development-password",

        SMS_DELIVERY_ENABLED:
          "true",

        SMS_PROVIDER:
          null,

        SMS_PROVIDER_MODE:
          "mock",

        TWILIO_FROM_NUMBER:
          null,

        TWILIO_SMS_FROM:
          "+447700900123",
      },
      async () => {
        const config =
          getMessageDeliveryConfig();

        assert.equal(
          config.mode,
          "sandbox"
        );

        assert.equal(
          config.email.provider,
          "smtp"
        );

        assert.equal(
          config.sms.provider,
          "twilio"
        );
      }
    );
  }
);

test(
  "email configuration exposes one compatible sender and SMTP shape",
  async () => {
    await withEnvironment(
      {
        MESSAGE_DELIVERY_MODE:
          "sandbox",

        EMAIL_DELIVERY_ENABLED:
          "true",

        EMAIL_PROVIDER:
          "smtp",

        EMAIL_FROM_NAME:
          "SalonAI",

        EMAIL_FROM_ADDRESS:
          "info@example.com",

        EMAIL_REPLY_TO:
          "reply@example.com",

        SMTP_HOST:
          "smtp.example.com",

        SMTP_PORT:
          "587",

        SMTP_USER:
          "info@example.com",

        SMTP_PASSWORD:
          "development-password",

        SMTP_CONNECTION_TIMEOUT_MS:
          "10000",

        SMTP_GREETING_TIMEOUT_MS:
          "11000",

        SMTP_SOCKET_TIMEOUT_MS:
          "30000",
      },
      async () => {
        const config =
          getMessageDeliveryConfig();

        assert.equal(
          config.email.sender.name,
          "SalonAI"
        );

        assert.equal(
          config.email.sender.address,
          "info@example.com"
        );

        assert.equal(
          config.email.sender.replyTo,
          "reply@example.com"
        );

        assert.equal(
          config.email.smtp.user,
          "info@example.com"
        );

        assert.equal(
          config.email.smtp.username,
          "info@example.com"
        );

        assert.equal(
          config.email.connectionTimeoutMs,
          10000
        );

        assert.equal(
          config.email.greetingTimeoutMs,
          11000
        );

        assert.equal(
          config.email.socketTimeoutMs,
          30000
        );

        assert.equal(
          config.email.smtp.connectionTimeoutMs,
          10000
        );

        assert.equal(
          config.email.smtp.greetingTimeoutMs,
          11000
        );

        assert.equal(
          config.email.smtp.socketTimeoutMs,
          30000
        );
      }
    );
  }
);

test(
  "TWILIO_SMS_FROM remains a compatibility alias for TWILIO_FROM_NUMBER",
  async () => {
    await withEnvironment(
      {
        MESSAGE_DELIVERY_MODE:
          "sandbox",

        SMS_DELIVERY_ENABLED:
          "true",

        SMS_PROVIDER:
          null,

        SMS_PROVIDER_MODE:
          "mock",

        TWILIO_FROM_NUMBER:
          null,

        TWILIO_SMS_FROM:
          "+447700900123",
      },
      async () => {
        const config =
          getMessageDeliveryConfig();

        assert.equal(
          config.sms.provider,
          "twilio"
        );

        assert.equal(
          config.sms.twilio.fromNumber,
          "+447700900123"
        );
      }
    );
  }
);

test(
  "live email validation exposes channel-specific errors and requires SMTP authentication",
  async () => {
    await withEnvironment(
      {
        MESSAGE_DELIVERY_MODE:
          "live",

        EMAIL_DELIVERY_ENABLED:
          "true",

        EMAIL_PROVIDER:
          "smtp",

        EMAIL_FROM_ADDRESS:
          "info@example.com",

        SMTP_HOST:
          "smtp.example.com",

        SMTP_USER:
          null,

        SMTP_PASSWORD:
          null,

        SMS_DELIVERY_ENABLED:
          "false",
      },
      async () => {
        const config =
          getMessageDeliveryConfig();

        const validation =
          validateMessageDeliveryConfig(
            config,
            {
              throwOnError: false,
            }
          );

        assert.equal(
          validation.valid,
          false
        );

        assert.ok(
          validation.channels
        );

        assert.ok(
          Array.isArray(
            validation.channels
              .email.errors
          )
        );

        assert.ok(
          validation.channels
            .email.errors
            .some(
              (message) =>
                /SMTP_USER/i.test(
                  message
                )
            )
        );

        assert.ok(
          validation.channels
            .email.errors
            .some(
              (message) =>
                /SMTP_PASSWORD/i.test(
                  message
                )
            )
        );
      }
    );
  }
);

test(
  "legacy SMS mock mode never attempts live Twilio delivery",
  async () => {
    await withEnvironment(
      {
        NODE_ENV:
          "development",

        SMS_DELIVERY_ENABLED:
          "false",

        SMS_PROVIDER:
          null,

        SMS_PROVIDER_MODE:
          "mock",

        TWILIO_ACCOUNT_SID:
          null,

        TWILIO_AUTH_TOKEN:
          null,

        TWILIO_FROM_NUMBER:
          null,

        TWILIO_SMS_FROM:
          null,
      },
      async () => {
        const result =
          await sendLegacySms({
            to:
              "+447700900123",

            message:
              "SalonAI regression test",
          });

        assert.equal(
          result.provider,
          "console"
        );

        assert.equal(
          result.status,
          "mocked"
        );

        assert.equal(
          result.delivered,
          false
        );
      }
    );
  }
);

test(
  "production refuses enabled WhatsApp console delivery",
  () => {
    const result =
      importEnvironmentModule(
        productionEnvironment({
          WHATSAPP_PROVIDER:
            "console",

          WHATSAPP_DELIVERY_ENABLED:
            "true",
        })
      );

    assert.notEqual(
      result.status,
      0
    );

    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /WhatsApp.*console|console.*WhatsApp/i
    );
  }
);

test(
  "production refuses sandbox email or SMS when an external channel is enabled",
  () => {
    const result =
      importEnvironmentModule(
        productionEnvironment({
          MESSAGE_DELIVERY_MODE:
            "sandbox",

          EMAIL_DELIVERY_ENABLED:
            "true",

          EMAIL_PROVIDER:
            "smtp",
        })
      );

    assert.notEqual(
      result.status,
      0
    );

    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /MESSAGE_DELIVERY_MODE.*live|live.*delivery/i
    );
  }
);