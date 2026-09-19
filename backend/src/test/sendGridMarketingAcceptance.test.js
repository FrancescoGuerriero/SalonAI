import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  assertSendGridMarketingAcceptanceConfiguration,
  buildSendGridMarketingAcceptancePlan,
  runSendGridMarketingAcceptance,
} from "../integrations/messaging/sendGridMarketingAcceptanceService.js";

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
        eventWebhook: {
          enabled:
            true,
          publicKey:
            "test-public-key",
        },
        marketing: {
          enabled:
            false,
          senderVerified:
            true,
          domainAuthenticated:
            true,
          acceptanceConfirmed:
            false,
        },
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

function validEnvironment(
  overrides = {}
) {
  return {
    SENDGRID_MARKETING_ACCEPTANCE_CONFIRM:
      "RUN_SENDGRID_MARKETING_ACCEPTANCE",
    SENDGRID_MARKETING_ACCEPTANCE_TO:
      "marketing-test@example.com",
    SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID:
      "42",
    SENDGRID_MARKETING_ACCEPTANCE_SUBJECT:
      "SalonAI marketing provider test",
    SENDGRID_MARKETING_ACCEPTANCE_MESSAGE:
      "Acceptance only.",
    ...overrides,
  };
}

test(
  "SendGrid marketing acceptance refuses a real send without deliberate confirmation",
  () => {
    assert.throws(
      () =>
        buildSendGridMarketingAcceptancePlan({
          SENDGRID_MARKETING_ACCEPTANCE_TO:
            "marketing-test@example.com",
          SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID:
            "42",
        }),
      (error) => {
        assert.equal(
          error.code,
          "SENDGRID_MARKETING_ACCEPTANCE_CONFIRMATION_REQUIRED"
        );
        return true;
      }
    );
  }
);

test(
  "SendGrid marketing acceptance requires a valid dedicated recipient and positive ASM group",
  () => {
    assert.throws(
      () =>
        buildSendGridMarketingAcceptancePlan(
          validEnvironment({
            SENDGRID_MARKETING_ACCEPTANCE_TO:
              "not-an-email",
          })
        ),
      /valid email/
    );

    assert.throws(
      () =>
        buildSendGridMarketingAcceptancePlan(
          validEnvironment({
            SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID:
              "0",
          })
        ),
      /positive integer/
    );
  }
);

test(
  "SendGrid marketing acceptance requires pre-activation provider readiness",
  () => {
    const config =
      validConfig();

    assert.equal(
      assertSendGridMarketingAcceptanceConfiguration(
        config
      ),
      config
    );

    const missingWebhook =
      validConfig();
    missingWebhook.email
      .sendgrid
      .eventWebhook.enabled =
      false;

    assert.throws(
      () =>
        assertSendGridMarketingAcceptanceConfiguration(
          missingWebhook
        ),
      /signed Event Webhook/
    );

    const enabled =
      validConfig();
    enabled.email
      .sendgrid
      .marketing.enabled =
      true;

    assert.throws(
      () =>
        assertSendGridMarketingAcceptanceConfiguration(
          enabled
        ),
      /before enabling live marketing/
    );
  }
);

test(
  "marketing acceptance verifies SMTP then sends one grouped test without changing activation",
  async () => {
    const calls = [];

    const result =
      await runSendGridMarketingAcceptance({
        environment:
          validEnvironment(),
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
            calls.push([
              "send",
              message,
            ]);

            return {
              success:
                true,
              accepted: [
                "marketing-test@example.com",
              ],
              rejected: [],
              providerMessageId:
                "sendgrid-marketing-message-1",
              sentAt:
                "2026-09-19T21:40:00.000Z",
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
        .metadata
        .purpose,
      "marketing_provider_acceptance"
    );
    assert.equal(
      calls[1][1]
        .metadata
        .sendGridSuppressionGroupId,
      42
    );

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.suppressionGroupId,
      42
    );
    assert.equal(
      result.providerMessageId,
      "sendgrid-marketing-message-1"
    );
    assert.equal(
      result.recipient.includes(
        "marketing-test"
      ),
      false
    );
    assert.equal(
      result.activationChanged,
      false
    );
    assert.equal(
      result.acceptanceConfirmed,
      false
    );
    assert.match(
      result.nextAction,
      /Event Webhook evidence/
    );
  }
);

test(
  "repository exposes marketing acceptance without persisting its confirmation token",
  async () => {
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
        "sendgrid:marketing-acceptance"
      ],
      "node scripts/testSendGridMarketingAcceptance.js"
    );

    assert.match(
      envExample,
      /^SENDGRID_MARKETING_ACCEPTANCE_TO=$/m
    );
    assert.match(
      envExample,
      /^SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID=$/m
    );
    assert.doesNotMatch(
      envExample,
      /^SENDGRID_MARKETING_ACCEPTANCE_CONFIRM=/m
    );
  }
);
