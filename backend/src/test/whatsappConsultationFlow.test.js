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

test("WhatsApp consultation questions follow the registered Hair Colour v1 sequence", () => {
  assert.deepEqual(nextWhatsAppConsultationQuestion({}), {
    field: "desiredOutcome",
    question: "What result would you like to achieve with your hair colour?",
  });

  assert.deepEqual(
    nextWhatsAppConsultationQuestion({
      desiredOutcome: "lighter blonde",
      currentColour: "dark blonde",
    }),
    {
      field: "naturalColour",
      question:
        "What is your natural hair colour or natural base, if you know it? Reply UNKNOWN if you are not sure.",
    }
  );

  const next = nextWhatsAppConsultationQuestion({
    desiredOutcome: "lighter blonde",
    currentColour: "dark blonde",
    naturalColour: "medium brown",
    colourHistory: "none",
    bleachHistory: "none",
    hairCondition: "healthy",
    length: "long",
    density: "medium",
    sensitivities: "none",
  });

  assert.equal(next, null);
});

test("Hair Colour v1 still collects registered enrichment fields when safety-required fields are prefilled", () => {
  const safetyComplete = {
    desiredOutcome: "copper",
    currentColour: "brown",
    hairCondition: "healthy",
    colourHistory: "none",
    bleachHistory: "none",
    sensitivities: "none",
  };

  assert.equal(
    nextWhatsAppConsultationQuestion(safetyComplete)?.field,
    "naturalColour"
  );

  assert.equal(
    nextWhatsAppConsultationQuestion({
      ...safetyComplete,
      naturalColour: "brown",
    })?.field,
    "length"
  );

  assert.equal(
    nextWhatsAppConsultationQuestion({
      ...safetyComplete,
      naturalColour: "brown",
      length: "medium",
    })?.field,
    "density"
  );
});

test("WhatsApp consultation assessment is definition/version scoped and fails closed", () => {
  assert.throws(
    () =>
      nextWhatsAppConsultationQuestion(
        {},
        {
          consultationType: "spa-skin-consultation",
          definitionVersion: "1",
        }
      ),
    (error) => error?.code === "CONSULTATION_DEFINITION_NOT_ACTIVE"
  );

  assert.throws(
    () =>
      nextWhatsAppConsultationQuestion(
        {},
        {
          consultationType: "hair-colour-chemical",
          definitionVersion: "999",
        }
      ),
    (error) => error?.code === "CONSULTATION_DEFINITION_NOT_ACTIVE"
  );
});
