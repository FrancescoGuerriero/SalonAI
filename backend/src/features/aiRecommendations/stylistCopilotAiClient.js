import {
  AiMicroserviceError,
  requestAiMicroservice,
} from "../../services/aiMicroserviceClient.js";

function toPythonPayload(context) {
  const sensitive = context?.sensitiveContext || {};
  const sensitiveKeys = Object.keys(sensitive).filter(
    (key) => sensitive[key] !== null && sensitive[key] !== undefined && sensitive[key] !== ""
  );

  const appointment = {
    appointmentId: context?.appointment?.id || "",
    status: context?.appointment?.status || "",
    startsAt: context?.appointment?.startsAt || "",
    appointmentTime: context?.appointment?.appointmentTime || "",
    bookingSource: context?.appointment?.bookingSource || "",
    serviceName: context?.appointment?.service?.name || "",
    serviceDescription: context?.appointment?.service?.description || "",
    stylistName: context?.appointment?.stylist?.name || "",
    notes: context?.appointment?.notes || "",
  };

  const consultation = {
    ...(context?.consultation?.structuredFeatures || {}),
    consultationStatus: context?.consultation?.status || "",
    deterministicFlags:
      context?.consultation?.deterministicAssessment?.flags || [],
    reviewDecision: context?.consultation?.review?.decision || "",
    reviewNotes: context?.consultation?.review?.notes || "",
    ...sensitive,
  };

  const hairProfile = context?.customer?.hairProfile || {};
  const preferences = {
    customerName: context?.customer?.displayName || "",
    recordedPreferences: context?.customer?.preferences || [],
    hairType: hairProfile.hairType || "",
    naturalHairColour: hairProfile.naturalHairColour || "",
    currentHairColour: hairProfile.currentHairColour || "",
    hairLength: hairProfile.hairLength || "",
    texture: hairProfile.texture || "",
    density: hairProfile.density || "",
    porosity: hairProfile.porosity || "",
    concerns: hairProfile.concerns || [],
  };

  return {
    capability: "stylist_copilot",
    definitionVersion: "1",
    tenantContext: context.tenantContext,
    actorContext: {
      actorId: context?.actor?.userId || "",
      role: context?.actor?.role || "staff",
      professionalDecisionOwner: true,
    },
    appointment,
    consultation,
    preferences,
    previousServices: (context?.history || []).map((item) => ({
      name: item.service || "Previous service",
      serviceName: item.service || "",
      stylistName: item.stylist || "",
      completedAt: item.startsAt || "",
      notes: item.notes || "",
    })),
    previousProducts: [],
    followUp: [],
    consentedContextKeys: context?.consent?.sensitiveContextIncluded
      ? sensitiveKeys
      : [],
    constraints: context.constraints,
  };
}

export function generateStylistCopilotBrief(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AiMicroserviceError(
      "A stylist-copilot payload is required.",
      { code: "STYLIST_COPILOT_PAYLOAD_REQUIRED", status: 422 }
    );
  }

  return requestAiMicroservice(
    "/api/v1/stylist-copilot/brief",
    {
      ...options,
      method: "POST",
      body: toPythonPayload(payload),
      authenticated: true,
    }
  );
}

export { toPythonPayload };

export default { generateStylistCopilotBrief, toPythonPayload };
