import {
  AiMicroserviceError,
  requestAiMicroservice,
} from "../../services/aiMicroserviceClient.js";

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
      body: payload,
      authenticated: true,
    }
  );
}

export default { generateStylistCopilotBrief };
