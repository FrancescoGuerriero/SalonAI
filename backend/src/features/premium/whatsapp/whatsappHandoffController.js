import mongoose from "mongoose";

import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  buildResumeWhatsAppBotMutation,
} from "./whatsappHandoffService.js";

function createHttpError(
  message,
  statusCode = 500,
  code = "WHATSAPP_HANDOFF_ERROR"
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  return error;
}

function assertConversationId(value) {
  if (!mongoose.isValidObjectId(value)) {
    throw createHttpError(
      "The WhatsApp conversation identifier is invalid.",
      400,
      "WHATSAPP_CONVERSATION_ID_INVALID"
    );
  }

  return value;
}

export async function resumeWhatsAppBot(
  request,
  response
) {
  const conversationId =
    assertConversationId(
      request.params.conversationId
    );

  const current =
    await WhatsAppConversation
      .findById(conversationId)
      .lean();

  if (!current) {
    throw createHttpError(
      "WhatsApp conversation not found.",
      404,
      "WHATSAPP_CONVERSATION_NOT_FOUND"
    );
  }

  const mutation =
    buildResumeWhatsAppBotMutation(
      current
    );

  const updated =
    await WhatsAppConversation
      .findOneAndUpdate(
        mutation.filter,
        mutation.update,
        {
          returnDocument: "after",
          runValidators: true,
        }
      )
      .select("-messages")
      .lean();

  if (!updated) {
    const latest =
      await WhatsAppConversation
        .findById(conversationId)
        .select(
          "bookingSession.confirmationState bookingSession.appointmentId bookingSession.confirmed"
        )
        .lean();

    if (!latest) {
      throw createHttpError(
        "WhatsApp conversation not found.",
        404,
        "WHATSAPP_CONVERSATION_NOT_FOUND"
      );
    }

    if (
      latest
        ?.bookingSession
        ?.confirmationState ===
      "processing"
    ) {
      throw createHttpError(
        "The WhatsApp booking started confirmation while the bot resume request was being processed.",
        409,
        "WHATSAPP_BOT_RESUME_CONFIRMATION_IN_PROGRESS"
      );
    }

    throw createHttpError(
      "The WhatsApp conversation changed while the bot resume request was being processed. Refresh and try again.",
      409,
      "WHATSAPP_BOT_RESUME_STATE_CHANGED"
    );
  }

  return response.json({
    success: true,
    resumed: true,
    staleBookingReset:
      mutation.staleBookingReset,
    conversation: updated,
  });
}

export default {
  resumeWhatsAppBot,
};
