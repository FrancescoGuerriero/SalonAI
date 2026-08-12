import API from "../api/axios.js";

const BASE =
  "/whatsapp/conversations";

export async function listWhatsAppConversations(
  params = {}
) {
  const response =
    await API.get(
      BASE,
      {
        params,
      }
    );

  return response.data;
}

export async function getWhatsAppConversation(
  conversationId
) {
  const response =
    await API.get(
      `${BASE}/${conversationId}`
    );

  return response.data
    ?.conversation;
}

export async function markWhatsAppConversationRead(
  conversationId
) {
  const response =
    await API.patch(
      `${BASE}/${conversationId}/read`
    );

  return response.data;
}

export async function updateWhatsAppConversationStatus(
  conversationId,
  status
) {
  const response =
    await API.patch(
      `${BASE}/${conversationId}/status`,
      {
        status,
      }
    );

  return response.data;
}

export async function updateWhatsAppBookingSession(
  conversationId,
  payload
) {
  const response =
    await API.patch(
      `${BASE}/${conversationId}/booking-session`,
      payload
    );

  return response.data;
}

export async function confirmWhatsAppBooking(
  conversationId
) {
  const response =
    await API.post(
      `${BASE}/${conversationId}/confirm-booking`
    );

  return response.data;
}

export async function sendWhatsAppConversationMessage(
  conversationId,
  message
) {
  const payload =
    typeof message === "string"
      ? {
          body: message,
        }
      : {
          ...(message || {}),
        };

  const response =
    await API.post(
      `${BASE}/${conversationId}/messages`,
      payload
    );

  return response.data;
}

export async function getWhatsAppOutboundPolicy(
  to
) {
  const response =
    await API.get(
      "/whatsapp/outbound-policy",
      {
        params: {
          to,
        },
      }
    );

  return response.data;
}

export async function sendOneOffWhatsAppMessage(
  payload
) {
  const response =
    await API.post(
      "/whatsapp/messages",
      payload
    );

  return response.data;
}

export default {
  confirmWhatsAppBooking,
  getWhatsAppConversation,
  getWhatsAppOutboundPolicy,
  listWhatsAppConversations,
  markWhatsAppConversationRead,
  sendOneOffWhatsAppMessage,
  sendWhatsAppConversationMessage,
  updateWhatsAppBookingSession,
  updateWhatsAppConversationStatus,
};
