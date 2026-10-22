const COLLECTABLE_CONSULTATION_STATUSES = new Set([
  "draft",
  "in_progress",
  "more_information_required",
]);

function createLifecycleError(
  message,
  {
    statusCode = 409,
    code = "WHATSAPP_BOT_RESUME_CONFLICT",
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  return error;
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function completedBooking(session = {}) {
  return Boolean(
    session.appointmentId ||
      session.confirmed === true ||
      session.confirmationState === "completed" ||
      session.stage === "confirmed"
  );
}

export function resolveWhatsAppResumeMode(
  conversation,
  consultationSession = null
) {
  if (!conversation?.activeConsultationId) {
    return "bot";
  }

  if (!consultationSession) {
    return "bot";
  }

  const conversationConsultationId = String(
    conversation.activeConsultationId?._id || conversation.activeConsultationId
  );
  const consultationId = String(
    consultationSession?._id || consultationSession?.id || ""
  );

  if (!consultationId || consultationId !== conversationConsultationId) {
    return "bot";
  }

  return COLLECTABLE_CONSULTATION_STATUSES.has(consultationSession.status)
    ? "consultation"
    : "bot";
}

export function isExpiredUnconfirmedWhatsAppBooking(
  conversation,
  {
    now = new Date(),
  } = {}
) {
  const session =
    conversation?.bookingSession || {};

  if (
    completedBooking(session) ||
    session.confirmationState === "processing"
  ) {
    return false;
  }

  const expiresAt =
    validDate(session.expiresAt);

  return Boolean(
    expiresAt &&
      expiresAt.getTime() <=
        now.getTime()
  );
}

export function buildResumeWhatsAppBotMutation(
  conversation,
  {
    now = new Date(),
    consultationSession = null,
  } = {}
) {
  if (!conversation?._id) {
    throw createLifecycleError(
      "A WhatsApp conversation is required.",
      {
        statusCode: 400,
        code:
          "WHATSAPP_CONVERSATION_REQUIRED",
      }
    );
  }

  const session =
    conversation.bookingSession || {};

  if (
    session.confirmationState ===
      "processing"
  ) {
    throw createLifecycleError(
      "The WhatsApp booking is currently being confirmed and cannot be returned to bot mode.",
      {
        code:
          "WHATSAPP_BOT_RESUME_CONFIRMATION_IN_PROGRESS",
      }
    );
  }

  if (completedBooking(session)) {
    throw createLifecycleError(
      "A completed WhatsApp booking cannot be returned to bot mode through the handoff resume operation.",
      {
        code:
          "WHATSAPP_BOT_RESUME_BOOKING_COMPLETED",
      }
    );
  }

  const staleBookingReset =
    isExpiredUnconfirmedWhatsAppBooking(
      conversation,
      { now }
    );
  const resumeMode = resolveWhatsAppResumeMode(
    conversation,
    consultationSession
  );

  const set = {
    assignedTo: null,
    "automation.mode": resumeMode,
    "automation.handoffRequested": false,
    "automation.handoffReason": "",
    "automation.lastAction":
      resumeMode === "consultation"
        ? "resume_consultation"
        : "resume_bot",
    "automation.lastError": "",
  };

  if (resumeMode === "consultation") {
    set["automation.lastIntent"] = "consultation";
  }

  if (staleBookingReset) {
    Object.assign(set, {
      status: "open",
      "automation.anyStylist": false,
      "automation.clarificationCount": 0,
      ...(resumeMode === "consultation"
        ? {}
        : { "automation.lastIntent": "" }),
      "automation.lastConfidence": null,
      "bookingSession.stage": "idle",
      "bookingSession.serviceId": null,
      "bookingSession.stylistId": null,
      "bookingSession.appointmentDate": null,
      "bookingSession.appointmentTime": "",
      "bookingSession.duration": null,
      "bookingSession.price": null,
      "bookingSession.availableSlots": [],
      "bookingSession.appointmentId": null,
      "bookingSession.confirmed": false,
      "bookingSession.confirmationState": "pending",
      "bookingSession.confirmedAt": null,
      "bookingSession.confirmedBy": null,
      "bookingSession.expiresAt": null,
    });
  }

  const filter = {
    _id: conversation._id,
    "bookingSession.confirmationState": {
      $ne: "processing",
    },
    "bookingSession.appointmentId": null,
    "bookingSession.confirmed": {
      $ne: true,
    },
  };

  if (staleBookingReset) {
    filter["bookingSession.expiresAt"] = {
      $lte: now,
    };
  }

  return {
    filter,
    update: {
      $set: set,
    },
    resumeMode,
    staleBookingReset,
  };
}

export default {
  buildResumeWhatsAppBotMutation,
  isExpiredUnconfirmedWhatsAppBooking,
  resolveWhatsAppResumeMode,
};
