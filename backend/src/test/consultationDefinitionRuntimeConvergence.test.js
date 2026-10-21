import assert from "node:assert/strict";
import test from "node:test";

import {
  getConsultationDefinition,
  requireConsultationDefinition,
} from "../features/consultations/consultationDefinitionRegistry.js";

import {
  nextWhatsAppConsultationQuestion,
} from "../features/premium/whatsapp/whatsappConsultationService.js";

test("WhatsApp runtime uses the registered active consultation definition", () => {
  const definition = getConsultationDefinition("hair-colour-chemical", "1");

  assert.ok(definition);
  assert.equal(definition.id, "hair-colour-chemical");
  assert.equal(definition.version, "1");
  assert.equal(definition.vertical, "salon");
  assert.equal(definition.active, true);

  assert.deepEqual(nextWhatsAppConsultationQuestion({}), {
    field: "desiredOutcome",
    question: "What result would you like to achieve with your hair colour?",
  });
});

test("future consultation definitions remain inactive until explicitly registered", () => {
  assert.equal(getConsultationDefinition("spa-skin-consultation", "1"), null);
  assert.throws(
    () => requireConsultationDefinition("spa-skin-consultation", "1"),
    (error) => error?.code === "CONSULTATION_DEFINITION_NOT_ACTIVE"
  );
});
