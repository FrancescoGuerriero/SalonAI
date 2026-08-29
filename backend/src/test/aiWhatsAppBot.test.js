import assert from "node:assert/strict";
import test from "node:test";

import {
  analyseWhatsAppBotMessage,
} from "../features/premium/whatsapp/whatsappBotAiClient.js";


const TEST_KEY =
  "test-whatsapp-ai-service-key-1234567890";


test(
  "WhatsApp bot client calls the authenticated AI endpoint",
  async () => {
    let capturedUrl = "";
    let capturedOptions = null;

    const fetchImpl =
      async (
        url,
        options
      ) => {
        capturedUrl = url;
        capturedOptions = options;

        return {
          ok: true,
          status: 200,

          headers: {
            get() {
              return "application/json";
            },
          },

          async json() {
            return {
              intent: "booking",
              confidence: 0.94,

              entities: {
                service_name:
                  "Blow-dry",
                stylist_name:
                  "Francesco P",
                date_text:
                  "tomorrow",
                time_text:
                  "3pm",
                customer_name:
                  "",
              },

              next_action:
                "check_availability",

              requires_human:
                false,

              reply_suggestion:
                "Checking availability.",

              provider_mode:
                "mock",

              model_name:
                "salonai-whatsapp-intent-rules-v1",

              rules_applied: [
                "booking-keyword",
              ],
            };
          },
        };
      };

    const result =
      await analyseWhatsAppBotMessage(
        {
          message:
            "Book Blow-dry with Francesco P tomorrow at 3pm",

          services: [
            "Blow-dry",
          ],

          stylists: [
            "Francesco P",
          ],
        },
        {
          fetchImpl,

          environment: {
            AI_SERVICE_URL:
              "http://ai-service:8000",

            AI_SERVICE_KEY:
              TEST_KEY,
          },
        }
      );

    assert.equal(
      capturedUrl,
      "http://ai-service:8000/api/v1/whatsapp-bot/analyse"
    );

    assert.equal(
      capturedOptions.method,
      "POST"
    );

    assert.equal(
      capturedOptions.headers[
        "X-SalonAI-Service-Key"
      ],
      TEST_KEY
    );

    const requestBody =
      JSON.parse(
        capturedOptions.body
      );

    assert.equal(
      requestBody.message,
      "Book Blow-dry with Francesco P tomorrow at 3pm"
    );

    assert.equal(
      result.intent,
      "booking"
    );

    assert.equal(
      result.next_action,
      "check_availability"
    );
  }
);


test(
  "WhatsApp bot client rejects an empty message",
  async () => {
    await assert.rejects(
      async () =>
        analyseWhatsAppBotMessage(
          {
            message: "   ",
          }
        ),

      (error) =>
        error.code ===
        "WHATSAPP_BOT_PAYLOAD_INVALID"
    );
  }
);