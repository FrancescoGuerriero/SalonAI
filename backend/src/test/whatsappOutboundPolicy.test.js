import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWhatsAppOutboundAllowed,
  evaluateWhatsAppOutboundPolicy,
} from "../features/premium/whatsapp/whatsappOutboundPolicy.js";

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test(
  "Meta approved template is allowed outside the customer service window",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      const policy =
        evaluateWhatsAppOutboundPolicy({
          templateName:
            "appointment_confirmed",
          templateLanguage:
            "en_GB",
        });

      assert.equal(
        policy.serviceWindowOpen,
        false
      );

      assert.equal(
        policy.templateRequired,
        true
      );

      assert.equal(
        policy.templateSupplied,
        true
      );

      assert.equal(
        policy.provider,
        "meta"
      );

      assert.equal(
        policy.templateName,
        "appointment_confirmed"
      );

      assert.equal(
        policy.allowed,
        true
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "Twilio Content SID remains allowed outside the customer service window",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "twilio";

      const policy =
        evaluateWhatsAppOutboundPolicy({
          contentSid:
            "HX12345678901234567890123456789012",
        });

      assert.equal(
        policy.serviceWindowOpen,
        false
      );

      assert.equal(
        policy.templateRequired,
        true
      );

      assert.equal(
        policy.templateSupplied,
        true
      );

      assert.equal(
        policy.provider,
        "twilio"
      );

      assert.equal(
        policy.contentSid,
        "HX12345678901234567890123456789012"
      );

      assert.equal(
        policy.allowed,
        true
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "free-form WhatsApp message is allowed inside the customer service window",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      const now =
        new Date(
          "2026-08-21T12:00:00Z"
        );

      const lastInboundAt =
        new Date(
          "2026-08-21T11:00:00Z"
        );

      const policy =
        evaluateWhatsAppOutboundPolicy({
          lastInboundAt,
          now,
        });

      assert.equal(
        policy.serviceWindowOpen,
        true
      );

      assert.equal(
        policy.templateRequired,
        false
      );

      assert.equal(
        policy.templateSupplied,
        false
      );

      assert.equal(
        policy.allowed,
        true
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "message without a template is rejected outside the customer service window",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      assert.throws(
        () =>
          assertWhatsAppOutboundAllowed(),
        (error) => {
          assert.equal(
            error.code,
            "WHATSAPP_TEMPLATE_REQUIRED"
          );

          assert.equal(
            error.statusCode,
            409
          );

          assert.equal(
            error.details.provider,
            "meta"
          );

          assert.equal(
            error.details.field,
            "templateName"
          );

          return true;
        }
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);