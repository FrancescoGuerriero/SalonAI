import assert from "node:assert/strict";
import mongoose from "mongoose";
import test from "node:test";

import {
  getConsultationAssistance,
} from "../features/consultations/consultationAiClient.js";
import {
  ConsultationAiContractError,
  requestConsultationInference,
  validateConsultationAiResponse,
} from "../features/consultations/consultationInferenceService.js";


function oid() {
  return new mongoose.Types.ObjectId();
}


function session(overrides = {}) {
  return {
    business: oid(),
    location: oid(),
    consultationType:
      "hair-colour-chemical",
    definitionVersion: "1",
    structuredFeatures: {
      desiredOutcome: "Copper",
      currentColour: "brown",
      hairCondition: "good",
      colourHistory: "none",
      bleachHistory: "none",
      sensitivities: "none",
    },
    ...overrides,
  };
}


function safeAiResponse(overrides = {}) {
  return {
    capability:
      "consultation_assistance",
    consultationType:
      "hair-colour-chemical",
    definitionVersion: "1",
    extractedFeatures: {
      desiredOutcome: "Copper",
    },
    incompleteFields: [],
    recommendation: {
      nextAction:
        "professional_review_required",
      bookingReady: false,
      advisoryOnly: true,
    },
    confidence: 0.8,
    rationale: [
      "Professional review is required.",
    ],
    attentionFlags: [],
    safetyBoundary: {
      humanReviewRequired: true,
      deterministicBookingBlock: false,
      bookingAuthorised: false,
      canonicalWritesPerformed: false,
      safetyOverridePerformed: false,
      medicalDiagnosisPerformed: false,
    },
    provenance: {
      providerMode: "mock",
      modelName:
        "salonai-consultation-structured-baseline",
      modelVersion: "1",
      promptVersion:
        "structured-foundation-v1",
      featureVersion:
        "hair-colour-consultation-features-v1",
      datasetVersion:
        "not-applicable-foundation-v1",
    },
    ...overrides,
  };
}


test("Node sends trusted consultation scope and preserves deterministic authority", async () => {
  let capturedRequest = null;
  let capturedOptions = null;

  const result =
    await requestConsultationInference({
      session: session(),
      requestId: "consultation-test-1",
      aiClient: async (
        request,
        options
      ) => {
        capturedRequest = request;
        capturedOptions = options;
        return safeAiResponse();
      },
    });

  assert.equal(
    capturedRequest.capability,
    "consultation_assistance"
  );
  assert.equal(
    capturedRequest.tenantContext
      .businessId.length,
    24
  );
  assert.equal(
    capturedRequest.tenantContext
      .locationId.length,
    24
  );
  assert.equal(
    capturedRequest.constraints
      .canonicalWritesAllowed,
    false
  );
  assert.equal(
    capturedRequest.constraints
      .safetyRuleOverrideAllowed,
    false
  );
  assert.equal(
    capturedOptions.requestId,
    "consultation-test-1"
  );
  assert.equal(
    result.deterministicAssessment
      .bookingBlocked,
    false
  );
  assert.equal(
    result.ai.state,
    "completed"
  );
  assert.equal(
    result.ai.modelVersion,
    "1"
  );
  assert.equal(
    result.ai.providerMode,
    "mock"
  );
});


test("Node rejects AI responses that claim booking authority", async () => {
  await assert.rejects(
    requestConsultationInference({
      session: session(),
      aiClient: async () =>
        safeAiResponse({
          safetyBoundary: {
            ...safeAiResponse()
              .safetyBoundary,
            bookingAuthorised: true,
          },
        }),
    }),
    (error) => {
      assert.ok(
        error instanceof
          ConsultationAiContractError
      );
      assert.equal(
        error.code,
        "CONSULTATION_AI_AUTHORITY_VIOLATION"
      );
      return true;
    }
  );
});


test("Node rejects AI responses that disagree with deterministic booking block", async () => {
  const blockedSession = session({
    structuredFeatures: {
      desiredOutcome: "Lighter blonde",
      currentColour: "dark brown",
      hairCondition: "fragile",
      colourHistory: "permanent colour",
      bleachHistory: "recent bleach",
      sensitivities:
        "previous colour reaction",
      patchTestRequired: true,
    },
  });

  await assert.rejects(
    requestConsultationInference({
      session: blockedSession,
      aiClient: async () =>
        safeAiResponse({
          safetyBoundary: {
            ...safeAiResponse()
              .safetyBoundary,
            deterministicBookingBlock:
              false,
          },
        }),
    }),
    (error) => {
      assert.equal(
        error.code,
        "CONSULTATION_AI_SAFETY_STATE_MISMATCH"
      );
      return true;
    }
  );
});


test("consultation client refuses unsafe constraints before calling Python", async () => {
  let called = false;

  await assert.rejects(
    getConsultationAssistance(
      {
        capability:
          "consultation_assistance",
        tenantContext: {
          businessId: "business-1",
          locationId: "location-1",
        },
        constraints: {
          humanReviewRequired: true,
          canonicalWritesAllowed: true,
          medicalDiagnosisAllowed: false,
          safetyRuleOverrideAllowed: false,
        },
      },
      {
        fetchImpl: async () => {
          called = true;
          throw new Error(
            "must not be called"
          );
        },
      }
    ),
    (error) => {
      assert.equal(
        error.code,
        "CONSULTATION_AI_CONSTRAINTS_UNSAFE"
      );
      return true;
    }
  );

  assert.equal(called, false);
});


test("consultation response validator requires versioned AI provenance", () => {
  const request = {
    consultationType:
      "hair-colour-chemical",
    definitionVersion: "1",
    constraints: {
      deterministicBookingBlock:
        false,
    },
  };
  const response = safeAiResponse();
  response.provenance.modelVersion = "";

  assert.throws(
    () =>
      validateConsultationAiResponse(
        response,
        request
      ),
    /modelVersion provenance/
  );
});
