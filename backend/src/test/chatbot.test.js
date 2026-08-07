import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatbotResponse,
  classifyChatbotIntent,
  validateChatbotMessage,
} from "../features/chatbot/chatbotService.js";

test("chatbot recognises booking questions", () => {
  assert.equal(
    classifyChatbotIntent("Can I book an appointment tomorrow?"),
    "booking"
  );
});

test("chatbot prioritises requests for a person", () => {
  assert.equal(
    classifyChatbotIntent("Can I speak to a person about my booking?"),
    "contact"
  );
});

test("chatbot uses the live service catalogue", () => {
  const result = buildChatbotResponse({
    message: "How much are your services?",
    services: [
      { name: "Cut and finish", price: 55, duration: 60 },
    ],
  });

  assert.equal(result.intent, "prices");
  assert.match(result.reply, /Cut and finish/);
  assert.match(result.reply, /£55\.00/);
  assert.deepEqual(result.actions, [
    { label: "View services and prices", to: "/services" },
  ]);
});

test("chatbot does not invent catalogue data", () => {
  const result = buildChatbotResponse({
    message: "Show me your services",
    services: [],
  });

  assert.match(result.reply, /not available yet/i);
});

test("chatbot validates empty and oversized messages", () => {
  assert.throws(
    () => validateChatbotMessage("   "),
    /enter a message/i
  );

  assert.throws(
    () => validateChatbotMessage("x".repeat(601)),
    /cannot exceed 600/i
  );
});
