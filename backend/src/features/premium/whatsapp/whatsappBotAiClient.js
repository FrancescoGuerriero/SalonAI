import {
  AiMicroserviceError,
  requestAiMicroservice,
} from "../../../services/aiMicroserviceClient.js";


function createPayloadError(
  message
) {
  return new AiMicroserviceError(
    message,
    {
      code:
        "WHATSAPP_BOT_PAYLOAD_INVALID",
      status: 422,
    }
  );
}


export function analyseWhatsAppBotMessage(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw createPayloadError(
      "A WhatsApp bot analysis payload is required."
    );
  }

  const message =
    String(
      payload.message || ""
    ).trim();

  if (!message) {
    throw createPayloadError(
      "A WhatsApp customer message is required."
    );
  }

  if (
    message.length > 4096
  ) {
    throw createPayloadError(
      "WhatsApp customer messages cannot exceed 4096 characters."
    );
  }

  return requestAiMicroservice(
    "/api/v1/whatsapp-bot/analyse",
    {
      ...options,
      method: "POST",
      body: {
        ...payload,
        message,
      },
      authenticated: true,
    }
  );
}


export default {
  analyseWhatsAppBotMessage,
};