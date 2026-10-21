import assert from "node:assert/strict";
import test from "node:test";

import {
  consultationConsentDecision,
  nextWhatsAppConsultationQuestion,
} from "../features/premium/whatsapp/whatsappConsultationService.js";

test("WhatsApp consultation requires explicit consent language", () => {
  assert.equal(consultationConsentDecision("CONSENT"), "accepted");
  assert.equal(consultationConsentDecision("I consent"), "accepted");
  assert.equal(consultationConsentDecision("human"), "declined");
  assert.equal(consultationConsentDecision("tell me more"), "unknown");
});

test("WhatsApp consultation questions follow deterministic required-field order", () => {
  assert.deepEqual(nextWhatsAppConsultationQuestion({}), {
    field: "desiredOutcome",
    question: "What result would you like to achieve with your hair colour?",
  });

  const next = nextWhatsAppConsultationQuestion({
    desiredOutcome: "lighter blonde",
    currentColour: "dark blonde",
    hairCondition: "healthy",
    colourHistory: "none",
    bleachHistory: "none",
    sensitivities: "none",
  });

  assert.equal(next, null);
});
