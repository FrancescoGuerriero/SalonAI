import assert from "node:assert/strict";
import test from "node:test";

import {
  runWhatsAppBotTurn,
} from "../features/premium/whatsapp/whatsappBotOrchestrator.js";

function botEnvironment() {
  return {
    WHATSAPP_BOT_ENABLED: "true",
    WHATSAPP_BOT_SEND_REPLIES: "false",
    WHATSAPP_BOT_MIN_CONFIDENCE: "0.75",
    WHATSAPP_BOT_SESSION_MINUTES: "30",
    WHATSAPP_BOT_MAX_SERVICE_OPTIONS: "8",
    SALON_TIME_ZONE: "Europe/London",
    SALON_OPENING_HOURS: "",
  };
}

function conversationFixture() {
  return {
    _id: "conversation-legacy-stylist",
    phone: "+447000000001",
    assignedTo: null,
    status: "open",
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
      confirmationState: "pending",
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
  };
}

const service = {
  _id: "service-legacy-test",
  name: "Blow-dry",
  category: "Cutting & Styling",
  price: 68,
  priceLabel: "",
  priceOnConsultation: false,
  duration: 60,
  onlineBookable: true,
  active: true,
};

const legacyStylist = {
  _id: "stylist-legacy-emma",
  name: "Emma Johnson",
  email: "emma@salonai.com",
  speciality: "Stylist",
  experience: 5,
};

const activeStylist = {
  _id: "stylist-maya",
  firstName: "Maya",
  lastName: "Thompson",
  services: ["service-legacy-test"],
  isActive: true,
  acceptsAppointments: true,
  profilePublished: true,
};

test(
  "legacy stylist without explicit active status is not bookable",
  async () => {
    const conversation = conversationFixture();

    const result = await runWhatsAppBotTurn(
      {
        conversation,
        incoming: {
          message:
            "Book Blow-dry with Emma Johnson on 2 September 2026 at 12:30",
          providerMessageId:
            "SM-LEGACY-STYLIST-1",
        },
        services: [service],
        stylists: [
          legacyStylist,
          activeStylist,
        ],
      },
      {
        environment: botEnvironment(),
        now: new Date(
          "2026-09-01T09:00:00.000Z"
        ),
        analyse: async () => ({
          intent: "booking",
          confidence: 1,
          entities: {
            service_name: "Blow-dry",
            stylist_name: "",
            date_text: "2 September 2026",
            time_text: "12:30",
            customer_name: "",
          },
          next_action: "check_availability",
          requires_human: false,
          reply_suggestion: "",
          provider_mode: "test",
          model_name: "test-model",
          rules_applied: [],
        }),
        getAvailableSlots: async () => {
          throw new Error(
            "Availability must not be checked for an unknown legacy stylist."
          );
        },
        persist: async () => {},
      }
    );

    assert.equal(
      result.requestedStylistUnavailable,
      true
    );
    assert.equal(result.handoff, false);
    assert.match(
      result.reply,
      /Emma Johnson is not currently available for booking/i
    );
    assert.match(
      result.reply,
      /Maya Thompson/
    );
    assert.equal(
      conversation.bookingSession.stylistId,
      null
    );
    assert.equal(
      conversation.bookingSession.appointmentId,
      null
    );
  }
);
