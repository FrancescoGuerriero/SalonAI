import {
  AiMicroserviceError,
  requestAiMicroservice,
} from "../../services/aiMicroserviceClient.js";


function requireObject(value, message, code) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new AiMicroserviceError(
      message,
      {
        code,
        status: 422,
      }
    );
  }

  return value;
}


export function getConsultationAssistance(
  payload,
  options = {}
) {
  const request = requireObject(
    payload,
    "A governed consultation inference payload is required.",
    "CONSULTATION_AI_PAYLOAD_REQUIRED"
  );

  if (
    request.capability !==
    "consultation_assistance"
  ) {
    throw new AiMicroserviceError(
      "The consultation AI capability is invalid.",
      {
        code:
          "CONSULTATION_AI_CAPABILITY_INVALID",
        status: 422,
      }
    );
  }

  const tenantContext =
    requireObject(
      request.tenantContext,
      "Trusted consultation tenant context is required.",
      "CONSULTATION_AI_TENANT_CONTEXT_REQUIRED"
    );

  if (
    !String(
      tenantContext.businessId || ""
    ).trim() ||
    !String(
      tenantContext.locationId || ""
    ).trim()
  ) {
    throw new AiMicroserviceError(
      "Trusted Business and Location are required for consultation AI.",
      {
        code:
          "CONSULTATION_AI_SCOPE_REQUIRED",
        status: 422,
      }
    );
  }

  const constraints =
    requireObject(
      request.constraints,
      "Consultation AI safety constraints are required.",
      "CONSULTATION_AI_CONSTRAINTS_REQUIRED"
    );

  if (
    constraints.humanReviewRequired !== true ||
    constraints.canonicalWritesAllowed !== false ||
    constraints.medicalDiagnosisAllowed !== false ||
    constraints.safetyRuleOverrideAllowed !== false
  ) {
    throw new AiMicroserviceError(
      "Consultation AI safety constraints must fail closed.",
      {
        code:
          "CONSULTATION_AI_CONSTRAINTS_UNSAFE",
        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/consultations/assist",
    {
      ...options,
      method: "POST",
      body: request,
      authenticated: true,
    }
  );
}
