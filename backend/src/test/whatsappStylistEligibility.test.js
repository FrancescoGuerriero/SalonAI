import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  appointmentEligibleStylistFilter,
  customerVisibleStylistFilter,
  extractRequestedStylistName,
  filterCustomerVisibleStylists,
  isAppointmentEligibleStylist,
  isCustomerVisibleStylist,
} from "../services/stylistBookingEligibilityService.js";
import {
  runWhatsAppBotTurn,
} from "../features/premium/whatsapp/whatsappBotOrchestrator.js";

const environment = {
  WHATSAPP_BOT_ENABLED: "true",
  WHATSAPP_BOT_SEND_REPLIES: "false",
  WHATSAPP_BOT_MIN_CONFIDENCE: "0.75",
  WHATSAPP_BOT_SESSION_MINUTES: "30",
  WHATSAPP_BOT_MAX_SERVICE_OPTIONS: "8",
  SALON_TIME_ZONE: "Europe/London",
  SALON_OPENING_HOURS: "",
};

const service = {
  _id: "service-1",
  name: "Blow-dry",
  category: "Cutting & Styling",
  price: 68,
  duration: 60,
  onlineBookable: true,
  priceOnConsultation: false,
  active: true,
};

const maya = {
  _id: "maya",
  firstName: "Maya",
  lastName: "Thompson",
  services: ["service-1"],
  isActive: true,
  profilePublished: true,
};

const luca = {
  _id: "luca",
  firstName: "Luca",
  lastName: "Romano",
  services: ["service-1"],
  isActive: true,
  profilePublished: true,
};

const legacyEmma = {
  _id: "emma",
  name: "Emma Johnson",
  services: ["service-1"],
};

function conversation() {
  return {
    _id: "conversation-eligibility",
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
    async save() {
      return this;
    },
  };
}

function analysis(stylistName = "") {
  return {
    intent: "booking",
    confidence: 0.99,
    entities: {
      service_name: "Blow-dry",
      stylist_name: stylistName,
      date_text: "tomorrow",
      time_text: "3pm",
      customer_name: "",
    },
    next_action: "check_availability",
    requires_human: false,
    reply_suggestion: "Checking availability.",
    provider_mode: "mock",
    model_name: "test-model",
    rules_applied: [],
  };
}

test("appointment and customer-visible eligibility fail closed", () => {
  assert.deepEqual(
    appointmentEligibleStylistFilter(),
    { isActive: true }
  );
  assert.deepEqual(
    customerVisibleStylistFilter(),
    {
      isActive: true,
      profilePublished: true,
    }
  );
  assert.equal(
    isAppointmentEligibleStylist(maya),
    true
  );
  assert.equal(
    isAppointmentEligibleStylist(legacyEmma),
    false
  );
  assert.equal(
    isCustomerVisibleStylist({
      ...maya,
      profilePublished: false,
    }),
    false
  );
  assert.deepEqual(
    filterCustomerVisibleStylists([
      maya,
      legacyEmma,
      { ...luca, isActive: false },
    ]).map((item) => item._id),
    ["maya"]
  );
});

test("extracts a specifically requested unknown stylist name", () => {
  assert.equal(
    extractRequestedStylistName(
      "Book Blow-dry with Emma Johnson tomorrow at 3pm"
    ),
    "Emma Johnson"
  );
  assert.equal(
    extractRequestedStylistName(
      "any available stylist"
    ),
    ""
  );
  assert.equal(
    extractRequestedStylistName(
      "Emma Johnson",
      { allowBareName: true }
    ),
    "Emma Johnson"
  );
});

test("busy named stylist offers nearby times and another stylist at the requested time", async () => {
  const state = conversation();
  const result = await runWhatsAppBotTurn(
    {
      conversation: state,
      incoming: {
        message:
          "Book Blow-dry with Maya Thompson tomorrow at 3pm",
        providerMessageId:
          "SM-BUSY-STYLIST",
      },
      services: [service],
      stylists: [maya, luca],
    },
    {
      environment,
      now: new Date(
        "2026-09-15T10:00:00.000Z"
      ),
      analyse: async () =>
        analysis("Maya Thompson"),
      getAvailableSlots:
        async ({ stylist }) => {
          if (stylist._id === "maya") {
            return ["14:30", "15:30"];
          }
          if (stylist._id === "luca") {
            return ["15:00"];
          }
          return [];
        },
      persist: async () => {},
    }
  );

  assert.equal(result.handoff, false);
  assert.match(
    result.reply,
    /That exact time is not available/i
  );
  assert.match(
    result.reply,
    /Available times with Maya Thompson/i
  );
  assert.match(result.reply, /14:30/);
  assert.match(result.reply, /15:30/);
  assert.match(
    result.reply,
    /Luca Romano is available at 15:00/i
  );
  assert.equal(
    state.bookingSession.stylistId,
    "maya"
  );
});

test("strict shared eligibility is wired through production booking surfaces", () => {
  const orchestrator = fs.readFileSync(
    new URL(
      "../features/premium/whatsapp/whatsappBotOrchestrator.js",
      import.meta.url
    ),
    "utf8"
  );
  const controller = fs.readFileSync(
    new URL(
      "../features/premium/whatsapp/whatsappController.js",
      import.meta.url
    ),
    "utf8"
  );
  const stylistController = fs.readFileSync(
    new URL(
      "../controllers/stylistController.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    orchestrator,
    /customerVisibleStylistFilter\(\)/
  );
  assert.match(
    controller,
    /appointmentEligibleStylistFilter\(\)/
  );
  assert.match(
    stylistController,
    /isCustomerVisibleStylist/
  );
  assert.doesNotMatch(
    orchestrator,
    /isActive:\s*\{\s*\$ne:\s*false/
  );
});
