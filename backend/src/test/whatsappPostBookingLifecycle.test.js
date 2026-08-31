import assert
  from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import test
  from "node:test";

import {
  buildReusableWhatsAppConversationFilter,
} from "../features/premium/whatsapp/whatsappWebhookController.js";


const WEBHOOK_URL =
  new URL(
    "../features/premium/whatsapp/whatsappWebhookController.js",
    import.meta.url
  );


test(
  "completed WhatsApp bookings are excluded from conversation reuse",
  () => {
    const filter =
      buildReusableWhatsAppConversationFilter(
        "+447700900000"
      );

    assert.equal(
      filter.phone,
      "+447700900000"
    );

    assert.equal(
      filter[
        "bookingSession.appointmentId"
      ],
      null
    );

    assert.deepEqual(
      filter[
        "bookingSession.confirmed"
      ],
      {
        $ne: true,
      }
    );

    assert.deepEqual(
      filter[
        "bookingSession.confirmationState"
      ],
      {
        $ne: "completed",
      }
    );

    assert.deepEqual(
      filter[
        "bookingSession.stage"
      ],
      {
        $ne: "confirmed",
      }
    );
  }
);


test(
  "webhook creates a fresh conversation when no reusable booking session exists",
  async () => {
    const source =
      await readFile(
        WEBHOOK_URL,
        "utf8"
      );

    assert.match(
      source,
      /WhatsAppConversation\.create/
    );

    assert.match(
      source,
      /buildReusableWhatsAppConversationFilter/
    );

    assert.doesNotMatch(
      source,
      /upsert:\s*true/
    );

    assert.match(
      source,
      /const latestConversation/
    );

    assert.match(
      source,
      /lastMessageAt:\s*-1/
    );

    assert.match(
      source,
      /_id:\s*latestConversation\._id/
    );

    assert.match(
      source,
      /latestConversation\?\.customer/
    );

    assert.match(
      source,
      /latestConversation\?\.displayName/
    );
  }
);
