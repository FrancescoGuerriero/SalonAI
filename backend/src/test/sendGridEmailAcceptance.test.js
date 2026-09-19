import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  assertSendGridAcceptanceConfiguration,
  buildSendGridEmailAcceptancePlan,
  runSendGridEmailAcceptance,
} from "../integrations/messaging/sendGridEmailAcceptanceService.js";

function validConfig() {
  return {
    mode:
      "live",
    email: {
      enabled:
        true,
      provider:
        "sendgrid",
      from: {
        address:
          "info@example.com",
      },
      sender: {
        name:
          "SalonAI",
        address:
          "info@example.com",
        replyTo:
          "",
      },
      replyTo:
        "",
      sendgrid: {
        apiKey:
          "SG.example-secret",
      },
      smtp: {
        host:
          "smtp.sendgrid.net",
        port:
          587,
        secure:
          false,
        requireTls:
          true,
        rejectUnauthorized:
          true,
        user:
          "apikey",
        username:
          "apikey",
        password:
          "SG.example-secret",
      },
    },
    sms: {
      enabled:
        false,
      provider:
        "twilio",
      twilio: {
        accountSid:
          "",
        authToken:
          "",
        fromNumber:
          "",
        messagingServiceSid:
          "",
      },
    },
  };
}

test("SendGrid acceptance refuses real delivery without deliberate confirmation", () => {
  assert.throws(
    () =>
      buildSendGridEmailAcceptancePlan({
        SENDGRID_API_KEY:
          "SG.example-secret",
        SENDGRID_ACCEPTANCE_TO:
          "test@example.com",
      }),
    (error) => {
      assert.equal(
        error.code,
        "SENDGRID_ACCEPTANCE_CONFIRMATION_REQUIRED"
      );
      return true;
    }
  );
});

test("SendGrid acceptance requires a SendGrid-shaped API key and recipient", () => {
  assert.throws(
    () =>
      buildSendGridEmailAcceptancePlan({
        SENDGRID_ACCEPTANCE_CONFIRM:
          "RUN_SENDGRID_EMAIL_ACCEPTANCE",
        SENDGRID_API_KEY:
          "not-sendgrid",
        SENDGRID_ACCEPTANCE_TO:
          "test@example.com",
      }),
    /beginning with SG/
  );

  assert.throws(
    () =>
      buildSendGridEmailAcceptancePlan({
        SENDGRID_ACCEPTANCE_CONFIRM:
          "RUN_SENDGRID_EMAIL_ACCEPTANCE",
        SENDGRID_API_KEY:
          "SG.example-secret",
        SENDGRID_ACCEPTANCE_TO:
          "not-an-email",
      }),
    /valid email/
  );
});

test("SendGrid live acceptance configuration remains provider-specific", () => {
  assert.equal(
    assertSendGridAcceptanceConfiguration(
      validConfig()
    ).email.provider,
    "sendgrid"
  );

  const wrong =
    validConfig();
  wrong.email.provider =
    "smtp";

  assert.throws(
    () =>
      assertSendGridAcceptanceConfiguration(
        wrong
      ),
    /EMAIL_PROVIDER=sendgrid/
  );
});

test("SendGrid acceptance verifies transport then sends one redacted test message", async () => {
  const calls = [];
  const result =
    await runSendGridEmailAcceptance({
      environment: {
        SENDGRID_ACCEPTANCE_CONFIRM:
          "RUN_SENDGRID_EMAIL_ACCEPTANCE",
        SENDGRID_API_KEY:
          "SG.example-secret",
        SENDGRID_ACCEPTANCE_TO:
          "francesco@example.com",
        SENDGRID_ACCEPTANCE_SUBJECT:
          "SalonAI provider test",
        SENDGRID_ACCEPTANCE_MESSAGE:
          "Acceptance only.",
      },
      config:
        validConfig(),
      verifyConnection:
        async () => {
          calls.push(
            "verify"
          );
          return {
            success:
              true,
          };
        },
      send:
        async (
          message
        ) => {
          calls.push(
            [
              "send",
              message,
            ]
          );
          return {
            success:
              true,
            accepted: [
              "francesco@example.com",
            ],
            rejected: [],
            providerMessageId:
              "sendgrid-message-1",
            sentAt:
              "2026-09-19T19:30:00.000Z",
          };
        },
    });

  assert.equal(
    calls[0],
    "verify"
  );
  assert.equal(
    calls[1][0],
    "send"
  );
  assert.equal(
    calls[1][1]
      .metadata.provider,
    "sendgrid"
  );
  assert.equal(
    result.success,
    true
  );
  assert.equal(
    result.provider,
    "sendgrid"
  );
  assert.equal(
    result.recipient.includes(
      "francesco"
    ),
    false
  );
  assert.equal(
    result.providerMessageId,
    "sendgrid-message-1"
  );
});


test("repository exposes SendGrid acceptance without persisting the confirmation token", async () => {
  const packageJson =
    JSON.parse(
      await readFile(
        new URL(
          "../../package.json",
          import.meta.url
        ),
        "utf8"
      )
    );
  const envExample =
    await readFile(
      new URL(
        "../../.env.example",
        import.meta.url
      ),
      "utf8"
    );

  assert.equal(
    packageJson.scripts[
      "sendgrid:acceptance"
    ],
    "node scripts/testSendGridEmailAcceptance.js"
  );
  assert.match(
    envExample,
    /^EMAIL_PROVIDER=sendgrid$/m
  );
  assert.match(
    envExample,
    /^SENDGRID_API_KEY=$/m
  );
  assert.doesNotMatch(
    envExample,
    /^SENDGRID_ACCEPTANCE_CONFIRM=/m
  );
});
