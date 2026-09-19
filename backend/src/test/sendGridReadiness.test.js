import assert from "node:assert/strict";
import test from "node:test";

import {
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
