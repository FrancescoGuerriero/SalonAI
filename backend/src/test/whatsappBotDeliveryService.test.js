import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverWhatsAppBotReply,
} from "../features/premium/whatsapp/whatsappBotDeliveryService.js";


const now =
  new Date(
    "2026-08-29T12:00:00.000Z"
  );


function conversationFixture(
  overrides = {}
) {
  return {
    _id: "conversation-1",
    phone: "+447000000000",
    customer: null,
    status: "open",
    lastInboundAt:
      new Date(
        "2026-08-29T11:55:00.000Z"
      ),
    ...overrides,
  };
}


test(
  "bot reply uses the open service window and records automation metadata",
  async () => {
    let sent = null;
    let recorded = null;

    const result =
      await deliverWhatsAppBotReply(
        {
          conversationId:
            "conversation-1",
          body:
            "  Available at 15:00.  ",
        },
        {
          now,
          findConversation:
            async () =>
              conversationFixture(),
          resolveCustomer:
            async () => null,
          send:
            async (payload) => {
              sent = payload;

              return {
                messageId:
                  "SM-BOT-1",
                status: "sent",
              };
            },
          recordReply:
            async (input) => {
              recorded = input;

              return {
                _id:
                  "conversation-1",
              };
            },
        }
      );

    assert.deepEqual(
      sent,
      {
        to: "+447000000000",
        message:
          "Available at 15:00.",
      }
    );

    assert.equal(
      recorded.body,
      "Available at 15:00."
    );

    assert.equal(
      recorded.delivery.messageId,
      "SM-BOT-1"
    );

    assert.equal(
      result.policy.serviceWindowOpen,
      true
    );
  }
);


test(
  "bot reply is blocked outside the customer service window",
  async () => {
    let sent = false;

    await assert.rejects(
      () =>
        deliverWhatsAppBotReply(
          {
            conversationId:
              "conversation-1",
            body:
              "Hello",
          },
          {
            now,
            findConversation:
              async () =>
                conversationFixture({
                  lastInboundAt:
                    new Date(
                      "2026-08-28T10:00:00.000Z"
                    ),
                }),
            resolveCustomer:
              async () => null,
            send:
              async () => {
                sent = true;
              },
          }
        ),
      (error) =>
        error?.code ===
          "WHATSAPP_TEMPLATE_REQUIRED"
    );

    assert.equal(
      sent,
      false
    );
  }
);


test(
  "bot reply respects customer unsubscribe state",
  async () => {
    let sent = false;

    await assert.rejects(
      () =>
        deliverWhatsAppBotReply(
          {
            conversationId:
              "conversation-1",
            body:
              "Hello",
          },
          {
            now,
            findConversation:
              async () =>
                conversationFixture(),
            resolveCustomer:
              async () => ({
                communicationPreferences: {
                  unsubscribed: true,
                },
              }),
            send:
              async () => {
                sent = true;
              },
          }
        ),
      (error) =>
        error?.code ===
          "WHATSAPP_CUSTOMER_OPTED_OUT"
    );

    assert.equal(
      sent,
      false
    );
  }
);
