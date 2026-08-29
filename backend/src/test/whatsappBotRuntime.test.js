import assert from "node:assert/strict";
import test from "node:test";

import {
  queueWhatsAppBotMessage,
  runWhatsAppBotRuntimeMessage,
} from "../features/premium/whatsapp/whatsappBotRuntime.js";


function environment(
  overrides = {}
) {
  return {
    WHATSAPP_BOT_ENABLED:
      "true",
    WHATSAPP_BOT_SEND_REPLIES:
      "false",
    WHATSAPP_BOT_MIN_CONFIDENCE:
      "0.75",
    WHATSAPP_BOT_SESSION_MINUTES:
      "30",
    WHATSAPP_BOT_MAX_SERVICE_OPTIONS:
      "8",
    SALON_TIME_ZONE:
      "Europe/London",
    ...overrides,
  };
}


const item = {
  conversationId:
    "conversation-1",
  incoming: {
    message:
      "Book a Blow-dry",
    providerMessageId:
      "SM-BOT-1",
  },
};


test(
  "runtime does nothing when the master bot switch is disabled",
  async () => {
    let processed = false;

    const result =
      await runWhatsAppBotRuntimeMessage(
        item,
        {
          environment: {},
          processMessage:
            async () => {
              processed = true;
            },
        }
      );

    assert.equal(
      result.skipped,
      "bot_disabled"
    );

    assert.equal(
      processed,
      false
    );
  }
);


test(
  "shadow mode processes and persists decisions without sending replies",
  async () => {
    let deliveries = 0;

    const result =
      await runWhatsAppBotRuntimeMessage(
        item,
        {
          environment:
            environment(),
          processMessage:
            async () => ({
              processed: true,
              reply:
                "Which date would you prefer?",
            }),
          deliverReply:
            async () => {
              deliveries += 1;
            },
        }
      );

    assert.equal(
      result.processed,
      true
    );

    assert.equal(
      result.delivered,
      false
    );

    assert.equal(
      result.deliverySkipped,
      "reply_disabled"
    );

    assert.equal(
      deliveries,
      0
    );
  }
);


test(
  "reply mode delivers the orchestrator reply exactly once",
  async () => {
    let deliveries = 0;

    const result =
      await runWhatsAppBotRuntimeMessage(
        item,
        {
          environment:
            environment({
              WHATSAPP_BOT_SEND_REPLIES:
                "true",
            }),
          processMessage:
            async () => ({
              processed: true,
              reply:
                "15:00 is available.",
            }),
          deliverReply:
            async (payload) => {
              deliveries += 1;

              assert.equal(
                payload.body,
                "15:00 is available."
              );

              return {
                delivery: {
                  messageId:
                    "SM-OUT-1",
                },
                policy: {
                  serviceWindowOpen:
                    true,
                },
              };
            },
        }
      );

    assert.equal(
      deliveries,
      1
    );

    assert.equal(
      result.delivered,
      true
    );

    assert.equal(
      result.delivery.messageId,
      "SM-OUT-1"
    );
  }
);


test(
  "delivery failure transfers the conversation to human handling",
  async () => {
    let failure = null;

    const result =
      await runWhatsAppBotRuntimeMessage(
        item,
        {
          environment:
            environment({
              WHATSAPP_BOT_SEND_REPLIES:
                "true",
            }),
          processMessage:
            async () => ({
              processed: true,
              reply:
                "Hello",
            }),
          deliverReply:
            async () => {
              const error =
                new Error(
                  "Provider unavailable"
                );

              error.code =
                "PROVIDER_DOWN";

              throw error;
            },
          markDeliveryFailure:
            async (value) => {
              failure = value;
            },
        }
      );

    assert.equal(
      result.deliveryError,
      true
    );

    assert.equal(
      result.handoff,
      true
    );

    assert.equal(
      failure.conversationId,
      "conversation-1"
    );
  }
);


test(
  "queue serialises messages for the same conversation",
  async () => {
    const order = [];

    const run =
      async (queuedItem) => {
        const id =
          queuedItem
            .incoming
            .providerMessageId;

        order.push(
          `start:${id}`
        );

        if (
          id === "SM-1"
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                15
              )
          );
        }

        order.push(
          `end:${id}`
        );

        return {
          processed: true,
        };
      };

    const first =
      queueWhatsAppBotMessage(
        {
          conversationId:
            "conversation-serial",
          incoming: {
            providerMessageId:
              "SM-1",
          },
        },
        {
          environment:
            environment(),
          run,
        }
      );

    const second =
      queueWhatsAppBotMessage(
        {
          conversationId:
            "conversation-serial",
          incoming: {
            providerMessageId:
              "SM-2",
          },
        },
        {
          environment:
            environment(),
          run,
        }
      );

    await Promise.all([
      first,
      second,
    ]);

    assert.deepEqual(
      order,
      [
        "start:SM-1",
        "end:SM-1",
        "start:SM-2",
        "end:SM-2",
      ]
    );
  }
);
