import test from "node:test";
import assert from "node:assert/strict";

import {
  CUSTOMER_SERVICE_WINDOW_MS,
  evaluateWhatsAppOutboundPolicy,
  isCustomerServiceWindowOpen,
  normaliseContentSid,
  normaliseTemplateVariables,
} from "../features/premium/whatsapp/whatsappOutboundPolicy.js";

test(
  "WhatsApp service window is open for an inbound message less than 24 hours old",
  () => {
    const now =
      new Date(
        "2026-08-09T12:00:00.000Z"
      );

    const inbound =
      new Date(
        now.getTime() -
          CUSTOMER_SERVICE_WINDOW_MS +
          1000
      );

    assert.equal(
      isCustomerServiceWindowOpen(
        inbound,
        now
      ),
      true
    );
  }
);

test(
  "WhatsApp service window closes after 24 hours",
  () => {
    const now =
      new Date(
        "2026-08-09T12:00:00.000Z"
      );

    const inbound =
      new Date(
        now.getTime() -
          CUSTOMER_SERVICE_WINDOW_MS -
          1
      );

    assert.equal(
      isCustomerServiceWindowOpen(
        inbound,
        now
      ),
      false
    );
  }
);

test(
  "WhatsApp policy requires a template outside the service window",
  () => {
    const result =
      evaluateWhatsAppOutboundPolicy({
        lastInboundAt:
          null,
      });

    assert.equal(
      result.allowed,
      false
    );

    assert.equal(
      result.templateRequired,
      true
    );
  }
);

test(
  "approved Content SID permits an outbound template outside the service window",
  () => {
    const contentSid =
      `HX${"a".repeat(32)}`;

    const result =
      evaluateWhatsAppOutboundPolicy({
        lastInboundAt:
          null,
        contentSid,
      });

    assert.equal(
      result.allowed,
      true
    );

    assert.equal(
      result.templateSupplied,
      true
    );
  }
);

test(
  "invalid WhatsApp Content SID is rejected",
  () => {
    assert.throws(
      () =>
        normaliseContentSid(
          "not-a-content-sid"
        ),
      /Content SID is invalid/
    );
  }
);

test(
  "WhatsApp template variables accept JSON objects",
  () => {
    assert.deepEqual(
      normaliseTemplateVariables(
        '{"1":"Francesco","2":1030}'
      ),
      {
        1: "Francesco",
        2: "1030",
      }
    );
  }
);
