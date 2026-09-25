import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTwilioWhatsAppOperationalReadinessReport,
  buildTwilioWhatsAppReadinessReport,
} from "../integrations/messaging/twilioWhatsAppReadinessService.js";

function environment(
  overrides = {}
) {
  return {
    MESSAGE_DELIVERY_MODE:
      "live",
    WHATSAPP_PROVIDER:
      "twilio",
    WHATSAPP_DELIVERY_ENABLED:
      "true",
    TWILIO_ACCOUNT_SID:
      `AC${"1".repeat(32)}`,
    TWILIO_AUTH_TOKEN:
      "2".repeat(32),
    TWILIO_WHATSAPP_FROM:
      "whatsapp:+447700900123",
    WHATSAPP_WEBHOOK_URL:
      "https://salonai.francescopicardi.co.uk/api/whatsapp/webhook",
    ...overrides,
  };
}

function readyOptions(
  overrides = {}
) {
  return {
    environment:
      environment(),
    featureControlsReadable:
      true,
    whatsappBookingFeatureEnabled:
      true,
    consultationFeatureEnabled:
      true,
    ...overrides,
  };
}

test(
  "Twilio WhatsApp readiness is true only when production configuration and feature controls pass",
  () => {
    const report =
      buildTwilioWhatsAppReadinessReport(
        readyOptions()
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
  "Twilio WhatsApp readiness blocks when feature controls or webhook configuration are unavailable",
  () => {
    const report =
      buildTwilioWhatsAppReadinessReport(
        readyOptions({
          environment:
            environment({
              WHATSAPP_WEBHOOK_URL:
                "http://localhost:5000/api/whatsapp/webhook",
            }),
          consultationFeatureEnabled:
            false,
        })
      );

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.ok(
      report.blockers.includes(
        "webhookUrlConfigured"
      )
    );
    assert.ok(
      report.blockers.includes(
        "consultationFeatureEnabled"
      )
    );
  }
);

test(
  "Twilio WhatsApp readiness output never exposes credentials",
  () => {
    const secret =
      "super-secret-auth-token-value";

    const report =
      buildTwilioWhatsAppReadinessReport(
        readyOptions({
          environment:
            environment({
              TWILIO_AUTH_TOKEN:
                secret,
            }),
        })
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
      report.runtime
        .credentialsConfigured,
      true
    );
  }
);

test(
  "operational Twilio WhatsApp readiness requires an active provider account",
  async () => {
    const report =
      await buildTwilioWhatsAppOperationalReadinessReport({
        ...readyOptions(),
        probeAccount:
          async () => ({
            status:
              "active",
          }),
      });

    assert.equal(
      report.readyForAcceptance,
      true
    );
    assert.equal(
      report.checks
        .providerAccountActive,
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
  }
);

test(
  "operational Twilio WhatsApp readiness blocks safely when provider authentication fails",
  async () => {
    const providerError =
      new Error(
        "Authenticate"
      );

    providerError.code =
      20003;
    providerError.status =
      401;

    const report =
      await buildTwilioWhatsAppOperationalReadinessReport({
        ...readyOptions(),
        probeAccount:
          async () => {
            throw providerError;
          },
      });

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.ok(
      report.blockers.includes(
        "providerAccountActive"
      )
    );
    assert.deepEqual(
      report.providerProbe,
      {
        attempted:
          true,
        success:
          false,
        errorCode:
          "20003",
        httpStatus:
          401,
      }
    );

    assert.equal(
      JSON.stringify(
        report
      ).includes(
        "Authenticate"
      ),
      false
    );
  }
);

test(
  "operational Twilio WhatsApp readiness does not contact Twilio while static configuration is blocked",
  async () => {
    let probeCalls = 0;

    const report =
      await buildTwilioWhatsAppOperationalReadinessReport({
        ...readyOptions({
          whatsappBookingFeatureEnabled:
            false,
        }),
        probeAccount:
          async () => {
            probeCalls += 1;
            return {
              status:
                "active",
            };
          },
      });

    assert.equal(
      report.readyForAcceptance,
      false
    );
    assert.equal(
      probeCalls,
      0
    );
    assert.equal(
      report.providerProbe
        .attempted,
      false
    );
  }
);
