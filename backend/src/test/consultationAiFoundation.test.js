import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import ConsultationSession from "../features/consultations/ConsultationSession.js";
import {
  buildConsultationInferenceRequest,
  evaluateHairColourConsultation,
  HAIR_COLOUR_RULESET_VERSION,
} from "../features/consultations/hairColourConsultationRules.js";
import {
  buildConsultationLearningRecord,
  evaluateConsultationLearningEligibility,
} from "../features/consultations/consultationLearningRecord.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("ConsultationSession is tenant/location owned and captures governed AI/review/outcome state", () => {
  assert.equal(ConsultationSession.schema.path("business").options.required, true);
  assert.equal(ConsultationSession.schema.path("business").options.immutable, true);
  assert.equal(ConsultationSession.schema.path("location").options.required, true);
  assert.equal(ConsultationSession.schema.path("location").options.immutable, true);
  assert.equal(ConsultationSession.schema.path("customer").options.required, true);
  assert.ok(ConsultationSession.schema.path("deterministicAssessment.rulesetVersion"));
  assert.ok(ConsultationSession.schema.path("ai.modelVersion"));
  assert.ok(ConsultationSession.schema.path("ai.datasetVersion"));
  assert.ok(ConsultationSession.schema.path("review.corrections"));
  assert.ok(ConsultationSession.schema.path("outcome.bookingConverted"));
  assert.ok(ConsultationSession.schema.path("learning.eligibility"));
});

test("hair-colour rules fail closed on incomplete information and reported sensitivity", () => {
  const assessment = evaluateHairColourConsultation({
    desiredOutcome: "Lighter blonde",
    currentColour: "dark blonde",
    hairCondition: "fragile with some breakage",
    colourHistory: "permanent colour",
    bleachHistory: "highlights six months ago",
    sensitivities: "known reaction to previous colour product",
    patchTestRequired: true,
  });

  assert.equal(assessment.rulesetVersion, HAIR_COLOUR_RULESET_VERSION);
  assert.equal(assessment.complete, true);
  assert.equal(assessment.requiredHumanReview, true);
  assert.equal(assessment.bookingBlocked, true);
  assert.equal(
    assessment.flags.some((flag) => flag.code === "reported-sensitivity" && flag.severity === "blocking"),
    true
  );
  assert.equal(
    assessment.flags.some((flag) => flag.code === "patch-test-required" && flag.severity === "blocking"),
    true
  );
});

test("consultation inference request carries trusted tenant scope and forbids canonical writes/safety overrides", () => {
  const request = buildConsultationInferenceRequest({
    session: {
      business: oid(),
      location: oid(),
      consultationType: "hair-colour-chemical",
      definitionVersion: "1",
      structuredFeatures: {
        desiredOutcome: "Copper",
        currentColour: "brown",
        hairCondition: "good",
        colourHistory: "none",
        bleachHistory: "none",
        sensitivities: "none",
      },
    },
  });

  assert.equal(request.capability, "consultation_assistance");
  assert.equal(request.constraints.humanReviewRequired, true);
  assert.equal(request.constraints.canonicalWritesAllowed, false);
  assert.equal(request.constraints.safetyRuleOverrideAllowed, false);
  assert.equal(request.constraints.medicalDiagnosisAllowed, false);
  assert.ok(request.tenantContext.businessId);
  assert.ok(request.tenantContext.locationId);
});

test("learning record is unavailable until consultation has human review and observed outcome", () => {
  const eligibility = evaluateConsultationLearningEligibility({
    business: oid(),
    location: oid(),
    status: "awaiting_review",
    governance: { dataProcessingConsent: true },
    deterministicAssessment: { rulesetVersion: HAIR_COLOUR_RULESET_VERSION },
    review: { decision: "" },
    outcome: { observedAt: null },
  });

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes("consultation-not-finalised"));
  assert.ok(eligibility.reasons.includes("missing-human-review-label"));
  assert.ok(eligibility.reasons.includes("outcome-not-observed"));
});

test("governed learning record excludes direct customer, appointment, conversation and transcript identifiers", () => {
  const result = buildConsultationLearningRecord({
    _id: oid(),
    business: oid(),
    location: oid(),
    customer: oid(),
    appointment: oid(),
    sourceConversation: oid(),
    consultationType: "hair-colour-chemical",
    definitionVersion: "1",
    status: "closed",
    governance: { dataProcessingConsent: true },
    structuredFeatures: {
      desiredOutcome: "Copper",
      currentColour: "brown",
      hairCondition: "good",
      colourHistory: "none",
      bleachHistory: "none",
      sensitivities: "none",
      privateNotes: "must never be exported",
    },
    deterministicAssessment: {
      rulesetVersion: HAIR_COLOUR_RULESET_VERSION,
      bookingBlocked: false,
      flags: [],
    },
    ai: {
      modelName: "consultation-baseline",
      modelVersion: "1",
      promptVersion: "1",
      featureVersion: "1",
      datasetVersion: "dataset-1",
      confidence: 0.81,
    },
    review: {
      decision: "approved",
      corrections: [{ field: "currentColour" }],
    },
    outcome: {
      finalDecision: "approved",
      bookingConverted: true,
      servicePerformed: true,
      customerAcceptedRecommendation: true,
      observedAt: new Date("2026-10-18T00:00:00Z"),
    },
  });

  assert.equal(result.eligible, true);
  assert.equal(result.record.privacy.customerIdentifierIncluded, false);
  assert.equal(result.record.privacy.appointmentIdentifierIncluded, false);
  assert.equal(result.record.privacy.conversationIdentifierIncluded, false);
  assert.equal(result.record.privacy.rawTranscriptIncluded, false);
  assert.equal("customer" in result.record, false);
  assert.equal("appointment" in result.record, false);
  assert.equal("sourceConversation" in result.record, false);
  assert.equal("privateNotes" in result.record.features, false);
  assert.equal(result.record.labels.bookingConverted, true);
});
