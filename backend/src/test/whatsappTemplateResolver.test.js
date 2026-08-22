import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWhatsAppEventTemplate,
} from "../providers/whatsapp/whatsappTemplateResolver.js";

const EVENTS = [
  "order_paid",
  "refund",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_reminder",
  "appointment_payment_request",
  "appointment_payment_failed",
  "appointment_payment_received",
];

const VALID_CONTENT_SID =
  "HX12345678901234567890123456789012";

function eventKey(eventName) {
  return eventName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function environmentKeys() {
  const keys = [
    "WHATSAPP_PROVIDER",
    "WHATSAPP_PROVIDER_MODE",
    "META_WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE",
  ];

  for (const eventName of EVENTS) {
    const key =
      eventKey(eventName);

    keys.push(
      `TWILIO_WHATSAPP_${key}_CONTENT_SID`,
      `META_WHATSAPP_${key}_TEMPLATE_NAME`,
      `META_WHATSAPP_${key}_TEMPLATE_LANGUAGE`
    );
  }

  return keys;
}

function snapshotEnvironment() {
  return new Map(
    environmentKeys().map(
      (key) => [
        key,
        process.env[key],
      ]
    )
  );
}

function clearEnvironment() {
  for (
    const key of environmentKeys()
  ) {
    delete process.env[key];
  }
}

function restoreEnvironment(snapshot) {
  clearEnvironment();

  for (
    const [key, value]
    of snapshot.entries()
  ) {
    if (value !== undefined) {
      process.env[key] =
        value;
    }
  }
}

test(
  "all transactional WhatsApp events resolve through Meta templates",
  () => {
    const snapshot =
      snapshotEnvironment();

    try {
      clearEnvironment();

      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env
        .META_WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE =
        "en_GB";

      for (
        const eventName of EVENTS
      ) {
        const key =
          eventKey(eventName);

        process.env[
          `META_WHATSAPP_${key}_TEMPLATE_NAME`
        ] =
          eventName;

        const template =
          resolveWhatsAppEventTemplate(
            eventName
          );

        assert.equal(
          template.provider,
          "meta",
          eventName
        );

        assert.equal(
          template.supplied,
          true,
          eventName
        );

        assert.equal(
          template.contentSid,
          "",
          eventName
        );

        assert.equal(
          template.templateName,
          eventName,
          eventName
        );

        assert.equal(
          template.templateLanguage,
          "en_GB",
          eventName
        );
      }
    } finally {
      restoreEnvironment(
        snapshot
      );
    }
  }
);

test(
  "all transactional WhatsApp events retain Twilio Content SID compatibility",
  () => {
    const snapshot =
      snapshotEnvironment();

    try {
      clearEnvironment();

      process.env.WHATSAPP_PROVIDER =
        "twilio";

      for (
        const eventName of EVENTS
      ) {
        const key =
          eventKey(eventName);

        process.env[
          `TWILIO_WHATSAPP_${key}_CONTENT_SID`
        ] =
          VALID_CONTENT_SID;

        const template =
          resolveWhatsAppEventTemplate(
            eventName
          );

        assert.equal(
          template.provider,
          "twilio",
          eventName
        );

        assert.equal(
          template.supplied,
          true,
          eventName
        );

        assert.equal(
          template.contentSid,
          VALID_CONTENT_SID,
          eventName
        );

        assert.equal(
          template.templateName,
          "",
          eventName
        );
      }
    } finally {
      restoreEnvironment(
        snapshot
      );
    }
  }
);

test(
  "Meta event-specific language overrides the default template language",
  () => {
    const snapshot =
      snapshotEnvironment();

    try {
      clearEnvironment();

      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env
        .META_WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE =
        "en_GB";

      process.env
        .META_WHATSAPP_ORDER_PAID_TEMPLATE_NAME =
        "order_paid";

      process.env
        .META_WHATSAPP_ORDER_PAID_TEMPLATE_LANGUAGE =
        "it";

      const template =
        resolveWhatsAppEventTemplate(
          "order_paid"
        );

      assert.equal(
        template.templateLanguage,
        "it"
      );
    } finally {
      restoreEnvironment(
        snapshot
      );
    }
  }
);