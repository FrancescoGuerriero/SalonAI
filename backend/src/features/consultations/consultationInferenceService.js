import {
  buildConsultationInferenceRequest,
} from "./hairColourConsultationRules.js";
import {
  getConsultationAssistance,
} from "./consultationAiClient.js";


export class ConsultationAiContractError extends Error {
  constructor(
    message,
    code = "CONSULTATION_AI_CONTRACT_INVALID"
  ) {
    super(message);
    this.name =
      "ConsultationAiContractError";
    this.code = code;
    this.status = 502;
    this.statusCode = 502;
  }
}


function text(value) {
  return String(value ?? "").trim();
}


function requireObject(
  value,
  message
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new ConsultationAiContractError(
      message
    );
  }

  return value;
}


function validateSafetyBoundary(
  boundary,
  request
) {
  const value = requireObject(
    boundary,
    "The consultation AI response is missing its safety boundary."
  );

  if (
    value.humanReviewRequired !== true ||
    value.bookingAuthorised !== false ||
    value.canonicalWritesPerformed !== false ||
    value.safetyOverridePerformed !== false ||
    value.medicalDiagnosisPerformed !== false
  ) {
    throw new ConsultationAiContractError(
      "The consultation AI response violated the fail-closed authority boundary.",
      "CONSULTATION_AI_AUTHORITY_VIOLATION"
    );
  }

  if (
    value.deterministicBookingBlock !==
    request.constraints
      .deterministicBookingBlock
  ) {
    throw new ConsultationAiContractError(
      "The consultation AI response disagrees with the authoritative booking block.",
      "CONSULTATION_AI_SAFETY_STATE_MISMATCH"
    );
  }
}


function validateProvenance(value) {
  const provenance =
    requireObject(
      value,
      "The consultation AI response is missing provenance metadata."
    );

  for (const field of [
    "providerMode",
    "modelName",
    "modelVersion",
    "promptVersion",
    "featureVersion",
    "datasetVersion",
  ]) {
    if (!text(provenance[field])) {
      throw new ConsultationAiContractError(
        `The consultation AI response is missing ${field} provenance.`
      );
    }
  }

  return provenance;
}


export function validateConsultationAiResponse(
  response,
  request
) {
  const value = requireObject(
    response,
    "The consultation AI response is invalid."
  );

  if (
    value.capability !==
      "consultation_assistance" ||
    value.consultationType !==
      request.consultationType ||
    value.definitionVersion !==
      request.definitionVersion
  ) {
    throw new ConsultationAiContractError(
      "The consultation AI response does not match the requested capability definition."
    );
  }

  validateSafetyBoundary(
    value.safetyBoundary,
    request
  );

  const provenance =
    validateProvenance(
      value.provenance
    );

  const confidence =
    Number(value.confidence);

  if (
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new ConsultationAiContractError(
      "The consultation AI response has an invalid confidence value."
    );
  }

  if (
    !Array.isArray(
      value.incompleteFields
    ) ||
    !Array.isArray(value.rationale) ||
    !Array.isArray(
      value.attentionFlags
    )
  ) {
    throw new ConsultationAiContractError(
      "The consultation AI response has invalid structured evidence."
    );
  }

  requireObject(
    value.recommendation,
    "The consultation AI response is missing its advisory recommendation."
  );

  return {
    ...value,
    confidence,
    provenance,
  };
}


export async function requestConsultationInference(
  {
    session,
    features,
    requestId,
    aiClient =
      getConsultationAssistance,
  } = {}
) {
  const request =
    buildConsultationInferenceRequest({
      session,
      features,
    });

  const response =
    await aiClient(
      request,
      {
        requestId,
      }
    );

  const validated =
    validateConsultationAiResponse(
      response,
      request
    );

  return Object.freeze({
    deterministicAssessment:
      request.deterministicAssessment,
    attentionFlags:
      Object.freeze([
        ...validated.attentionFlags,
      ]),
    ai: Object.freeze({
      state: "completed",
      capability:
        validated.capability,
      modelName:
        validated.provenance
          .modelName,
      modelVersion:
        validated.provenance
          .modelVersion,
      promptVersion:
        validated.provenance
          .promptVersion,
      featureVersion:
        validated.provenance
          .featureVersion,
      datasetVersion:
        validated.provenance
          .datasetVersion,
      confidence:
        validated.confidence,
      recommendation:
        validated.recommendation,
      rationale:
        Object.freeze([
          ...validated.rationale,
        ]),
      incompleteFields:
        Object.freeze([
          ...validated.incompleteFields,
        ]),
      providerMode:
        validated.provenance
          .providerMode,
    }),
  });
}
