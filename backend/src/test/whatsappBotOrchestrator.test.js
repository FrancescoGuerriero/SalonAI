import assert from "node:assert/strict";
import test from "node:test";

import {
  getWhatsAppBotConfig,
  normaliseBotDate,
  normaliseBotTime,
  runWhatsAppBotTurn,
  selectPreferredSlots,
} from "../features/premium/whatsapp/whatsappBotOrchestrator.js";


function botEnvironment(
  overrides = {}
) {
  return {
    WHATSAPP_BOT_ENABLED: "true",
    WHATSAPP_BOT_SEND_REPLIES: "false",
    WHATSAPP_BOT_MIN_CONFIDENCE: "0.75",
    WHATSAPP_BOT_SESSION_MINUTES: "30",
    WHATSAPP_BOT_MAX_SERVICE_OPTIONS: "8",
    SALON_TIME_ZONE: "Europe/London",
    SALON_OPENING_HOURS: "",
    ...overrides,
  };
}


function conversationFixture(
  overrides = {}
) {
  return {
    _id: "conversation-1",
    phone: "+447000000000",
    assignedTo: null,
    status: "open",
    lastInboundAt:
      new Date(
        "2026-08-29T09:00:00.000Z"
      ),
    bookingSession: {
      stage: "idle",
      serviceId: null,
      stylistId: null,
      appointmentDate: null,
      appointmentTime: "",
      duration: null,
      price: null,
      availableSlots: [],
      appointmentId: null,
      confirmed: false,
      confirmationState:
        "pending",
      expiresAt: null,
    },
    automation: {
      mode: "bot",
      handoffRequested: false,
      handoffReason: "",
      anyStylist: false,
      clarificationCount: 0,
      lastProcessedMessageId: "",
    },
    messages: [],
    async save() {
      return this;
    },
    ...overrides,
  };
}


const estimatedService = {
  _id: "service-1",
  name: "Blow-dry",
  category:
    "Cutting & Styling",
  price: 68,
  priceLabel: "",
  priceOnConsultation: false,
  duration: 60,
  durationEstimated: true,
  onlineBookable: true,
  active: true,
};


const consultationService = {
  ...estimatedService,
  _id: "service-2",
  name: "Hair up",
  price: 0,
  priceLabel:
    "Price on consultation",
  priceOnConsultation: true,
};


const stylist = {
  _id: "stylist-1",
  firstName: "Francesco",
  lastName: "P",
  services: [
    "service-1",
    "service-2",
  ],
  isActive: true,
  profilePublished: true,
};


function bookingAnalysis(
  overrides = {}
) {
  return {
    intent: "booking",
    confidence: 0.99,
    entities: {
      service_name:
        "Blow-dry",
      stylist_name:
        "Francesco P",
      date_text:
        "tomorrow",
      time_text:
        "3pm",
      customer_name: "",
    },
    next_action:
      "check_availability",
    requires_human: false,
    reply_suggestion:
      "Checking availability.",
    provider_mode: "mock",
    model_name: "test-model",
    rules_applied: [],
    ...overrides,
  };
}


test(
  "bot configuration remains disabled by default",
  () => {
    const config =
      getWhatsAppBotConfig(
        {}
      );

    assert.equal(
      config.enabled,
      false
    );

    assert.equal(
      config.sendReplies,
      false
    );
  }
);


test(
  "normalises booking dates, times and dayparts",
  () => {
    const now =
      new Date(
        "2026-08-29T09:00:00.000Z"
      );

    assert.equal(
      normaliseBotDate(
        "tomorrow",
        {
          now,
          timeZone:
            "Europe/London",
        }
      ),
      "2026-08-30"
    );

    assert.equal(
      normaliseBotDate(
        "3 September",
        {
          now,
          timeZone:
            "Europe/London",
        }
      ),
      "2026-09-03"
    );

    assert.equal(
      normaliseBotTime(
        "3pm"
      ),
      "15:00"
    );

    assert.equal(
      normaliseBotTime(
        "afternoon"
      ),
      "afternoon"
    );

    assert.deepEqual(
      selectPreferredSlots(
        [
          "10:00",
          "13:00",
          "14:00",
          "17:30",
        ],
        "afternoon",
        3
      ),
      [
        "13:00",
        "14:00",
      ]
    );
  }
);


test(
  "estimated 60-minute service can reach booking review",
  async () => {
    const conversation =
      conversationFixture();

    let persisted = 0;

    const result =
      await runWhatsAppBotTurn(
        {
          conversation,
          incoming: {
            message:
              "Book Blow-dry with Francesco P tomorrow at 3pm",
            providerMessageId:
              "SM-BOOK-1",
          },
          services: [
            estimatedService,
          ],
          stylists: [
            stylist,
          ],
        },
        {
          environment:
            botEnvironment(),
          now:
            new Date(
              "2026-08-29T09:00:00.000Z"
            ),
          analyse:
            async () =>
              bookingAnalysis(),
          getAvailableSlots:
            async () => [
              "14:30",
              "15:00",
              "15:30",
            ],
          persist:
            async () => {
              persisted += 1;
            },
        }
      );

    assert.equal(
      persisted,
      1
    );

    assert.equal(
      result.bookingReady,
      true
    );

    assert.equal(
      result.handoff,
      false
    );

    assert.equal(
      conversation.status,
      "awaiting_confirmation"
    );

    assert.equal(
      conversation
        .bookingSession
        .stage,
      "review"
    );

    assert.equal(
      conversation
        .bookingSession
        .duration,
      60
    );

    assert.equal(
      conversation
        .bookingSession
        .appointmentTime,
      "15:00"
    );

    assert.equal(
      conversation
        .bookingSession
        .appointmentDate
        .toISOString()
        .slice(0, 10),
      "2026-08-30"
    );

    assert.equal(
      conversation
        .automation
        .lastProcessedMessageId,
      "SM-BOOK-1"
    );
  }
);


test(
  "any available stylist can produce afternoon slot choices",
  async () => {
    const conversation =
      conversationFixture();

    const result =
      await runWhatsAppBotTurn(
        {
          conversation,
          incoming: {
            message:
              "Blow-dry tomorrow afternoon with anyone available",
            providerMessageId:
              "SM-ANY-1",
          },
          services: [
            estimatedService,
          ],
          stylists: [
            stylist,
          ],
        },
        {
          environment:
            botEnvironment(),
          now:
            new Date(
              "2026-08-29T09:00:00.000Z"
            ),
          analyse:
            async () =>
              bookingAnalysis({
                entities: {
                  service_name:
                    "Blow-dry",
                  stylist_name:
                    "Any available stylist",
                  date_text:
                    "tomorrow",
                  time_text:
                    "afternoon",
                  customer_name: "",
                },
              }),
          getAvailableSlots:
            async () => [
              "10:00",
              "13:00",
              "14:00",
              "17:00",
            ],
          persist:
            async () => {},
        }
      );

    assert.equal(
      result.handoff,
      false
    );

    assert.deepEqual(
      result.offeredSlots,
      [
        "13:00",
        "14:00",
      ]
    );

    assert.equal(
      conversation
        .bookingSession
        .stage,
      "time"
    );

    assert.equal(
      String(
        conversation
          .bookingSession
          .stylistId
      ),
      "stylist-1"
    );
  }
);


test(
  "price-on-consultation service is handed to staff",
  async () => {
    const conversation =
      conversationFixture();

    const result =
      await runWhatsAppBotTurn(
        {
          conversation,
          incoming: {
            message:
              "Book Hair up tomorrow",
            providerMessageId:
              "SM-CONSULT-1",
          },
          services: [
            consultationService,
          ],
          stylists: [
            stylist,
          ],
        },
        {
          environment:
            botEnvironment(),
          now:
            new Date(
              "2026-08-29T09:00:00.000Z"
            ),
          analyse:
            async () =>
              bookingAnalysis({
                entities: {
                  service_name:
                    "Hair up",
                  stylist_name: "",
                  date_text:
                    "tomorrow",
                  time_text: "",
                  customer_name: "",
                },
              }),
          persist:
            async () => {},
        }
      );

    assert.equal(
      result.handoff,
      true
    );

    assert.equal(
      result
        .serviceRequiresConsultation,
      true
    );

    assert.equal(
      conversation
        .automation
        .handoffReason,
      "service_price_requires_consultation"
    );

    assert.equal(
      conversation
        .bookingSession
        .appointmentId,
      null
    );
  }
);


test(
  "CONFIRM hands a reviewed slot to staff without creating appointment",
  async () => {
    let analyseCalled =
      false;

    const conversation =
      conversationFixture({
        status:
          "awaiting_confirmation",
        bookingSession: {
          stage: "review",
          serviceId:
            "service-1",
          stylistId:
            "stylist-1",
          appointmentDate:
            new Date(
              "2026-08-30T12:00:00.000Z"
            ),
          appointmentTime:
            "15:00",
          duration: 60,
          price: 68,
          availableSlots: [],
          appointmentId: null,
          confirmed: false,
          confirmationState:
            "pending",
          expiresAt:
            new Date(
              "2026-08-29T09:30:00.000Z"
            ),
        },
      });

    const result =
      await runWhatsAppBotTurn(
        {
          conversation,
          incoming: {
            message: "CONFIRM",
            providerMessageId:
              "SM-CONFIRM-1",
          },
          services: [
            estimatedService,
          ],
          stylists: [
            stylist,
          ],
        },
        {
          environment:
            botEnvironment(),
          now:
            new Date(
              "2026-08-29T09:05:00.000Z"
            ),
          analyse:
            async () => {
              analyseCalled = true;
              throw new Error(
                "AI must not be used for deterministic confirmation."
              );
            },
          persist:
            async () => {},
        }
      );

    assert.equal(
      analyseCalled,
      false
    );

    assert.equal(
      result.handoff,
      true
    );

    assert.equal(
      conversation
        .automation
        .mode,
      "human"
    );

    assert.equal(
      conversation
        .automation
        .handoffReason,
      "customer_confirmed_slot"
    );

    assert.equal(
      conversation
        .bookingSession
        .appointmentId,
      null
    );

    assert.equal(
      conversation
        .bookingSession
        .confirmed,
      false
    );
  }
);


test(
  "already processed provider message is idempotently skipped",
  async () => {
    const conversation =
      conversationFixture({
        automation: {
          mode: "bot",
          handoffRequested: false,
          handoffReason: "",
          anyStylist: false,
          clarificationCount: 0,
          lastProcessedMessageId:
            "SM-DUPLICATE",
        },
      });

    const result =
      await runWhatsAppBotTurn(
        {
          conversation,
          incoming: {
            message: "Hello",
            providerMessageId:
              "SM-DUPLICATE",
          },
          services: [],
          stylists: [],
        },
        {
          environment:
            botEnvironment(),
          analyse:
            async () => {
              throw new Error(
                "AI must not run for duplicate message."
              );
            },
          persist:
            async () => {
              throw new Error(
                "Duplicate turn must not persist again."
              );
            },
        }
      );

    assert.equal(
      result.processed,
      false
    );

    assert.equal(
      result.skipped,
      "already_processed"
    );
  }
);
