import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSendGridOperationalReadinessReport,
  buildSendGridReadinessReport,
} from "../integrations/messaging/sendGridReadinessService.js";

function config(
  overrides = {}
) {
  const base = {
    mode: "live",
    email: {
      enabled: true,
      provider: "sendgrid",
      sender: {
        address:
          "info@example.com",
      },
      from: {
        address:
          "info@example.com",
      },
      smtp: {
        host:
          "smtp.sendgrid.net",
        port: 587,
        user: "apikey",
        password:
          "SG.super-secret-test-key",
      },
      sendgrid: {
        apiKey:
          "SG.super-secret-test-key",
        eventWebhook: {
          enabled: true,
          publicKey:
            "test-public-key",
        },
        marketing: {
          senderVerified: true,
          domainAuthenticated: true,
        },
      },
    },
    sms: {
      enabled: false,
      provider: "twilio",
      twilio: {},
    },
  };

  return {
    ...base,
    ...overrides,
    email: {
      ...base.email,
      ...(overrides.email || {}),
      sender: {
        ...base.email.sender,
        ...(overrides.email?.sender || {}),
      },
      from: {
        ...base.email.from,
        ...(overrides.email?.from || {}),
      },
      smtp: {
        ...base.email.smtp,
        ...(overrides.email?.smtp || {}),
      },
      sendgrid: {
        ...base.email.sendgrid,
        ...(overrides.email?.sendgrid || {}),
        eventWebhook: {
          ...base.email.sendgrid.eventWebhook,
          ...(overrides.email?.sendgrid?.eventWebhook || {}),
        },
        marketing: {
          ...base.email.sendgrid.marketing,
          ...(overrides.email?.sendgrid?.marketing || {}),
        },
      },
    },
    sms: {
      ...base.sms,
      ...(overrides.sms || {}),
      twilio: {
        ...base.sms.twilio,
        ...(overrides.sms?.twilio || {}),
      },
    },
  };
}

test(
  "SendGrid readiness is true only when application and provider checks pass",
  () => {
    const report =
      buildSendGridReadinessReport(
        config()
      );

    assert.equal(
      report.readyForAcceptance,
      true
    );
    assert.deepEqual(
      report.blockers,
      []
    );
  }
);

test(
  "SendGrid readiness reports provider and webhook blockers safely",
  () => {
    const report =
      buildSendGridReadinessReport(
        config({
          email: {
            sendgrid: {
              eventWebhook: {
                enabled: false,
                publicKey: "",
              },
              marketing: {
                senderVerified:
                  false,
                domainAuthenticated:
                  false,
              },
            },
          },
        })
      );

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.ok(
      report.blockers.includes(
        "signedEventWebhook"
      )
    );
    assert.ok(
      report.blockers.includes(
        "senderVerified"
      )
    );
    assert.ok(
      report.blockers.includes(
        "domainAuthenticated"
      )
    );
  }
);

test(
  "SendGrid readiness output never exposes the API key",
  () => {
    const secret =
      "SG.super-secret-test-key";

    const report =
      buildSendGridReadinessReport(
        config()
      );

    const serialised =
      JSON.stringify(
        report
      );

    assert.equal(
      serialised.includes(
        secret
      ),
      false
    );
    assert.equal(
      report.email
        .apiKeyConfigured,
      true
    );
  }
);


test(
  "operational SendGrid readiness requires a successful provider connection probe",
  async () => {
    const report =
      await buildSendGridOperationalReadinessReport({
        suppliedConfig:
          config(),
        verifyConnection:
          async () => ({
            success: true,
            provider:
              "sendgrid",
            host:
              "smtp.sendgrid.net",
            port: 587,
            verifiedAt:
              "2026-09-25T19:30:00.000Z",
          }),
      });

    assert.equal(
      report.readyForAcceptance,
      true
    );
    assert.equal(
      report.checks
        .providerConnection,
      true
    );
    assert.equal(
      report.providerProbe
        .attempted,
      true
    );
    assert.equal(
      report.providerProbe
        .success,
      true
    );
    assert.deepEqual(
      report.blockers,
      []
    );
  }
);

test(
  "operational SendGrid readiness blocks safely when the provider rejects SMTP verification",
  async () => {
    const providerError =
      new Error(
        "451 Authentication failed: Maximum credits exceeded"
      );

    providerError.code =
      "SMTP_VERIFICATION_FAILED";

    providerError
      .providerResponse = {
        responseCode: 451,
        response:
          "451 Authentication failed: Maximum credits exceeded",
      };

    const report =
      await buildSendGridOperationalReadinessReport({
        suppliedConfig:
          config(),
        verifyConnection:
          async () => {
            throw providerError;
          },
      });

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.equal(
      report.checks
        .providerConnection,
      false
    );
    assert.ok(
      report.blockers.includes(
        "providerConnection"
      )
    );
    assert.ok(
      report.providerBlockers.includes(
        "providerConnection"
      )
    );
    assert.deepEqual(
      report.providerProbe,
      {
        attempted: true,
        success: false,
        errorCode:
          "SMTP_VERIFICATION_FAILED",
        responseCode: 451,
      }
    );

    const serialised =
      JSON.stringify(
        report
      );

    assert.equal(
      serialised.includes(
        "Maximum credits exceeded"
      ),
      false
    );
  }
);

test(
  "operational SendGrid readiness does not contact the provider while static configuration is blocked",
  async () => {
    let verificationCalls = 0;

    const report =
      await buildSendGridOperationalReadinessReport({
        suppliedConfig:
          config({
            email: {
              sendgrid: {
                marketing: {
                  senderVerified:
                    false,
                },
              },
            },
          }),
        verifyConnection:
          async () => {
            verificationCalls += 1;
            return {
              success: true,
            };
          },
      });

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.equal(
      report.providerProbe
        .attempted,
      false
    );
    assert.equal(
      verificationCalls,
      0
    );
    assert.ok(
      report.blockers.includes(
        "senderVerified"
      )
    );
  }
);
