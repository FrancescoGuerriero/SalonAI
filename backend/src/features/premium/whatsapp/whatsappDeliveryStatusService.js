import WhatsAppConversation from "./WhatsAppConversation.js";

const CALLBACK_STATUSES =
  new Set([
    "accepted",
    "queued",
    "sending",
    "sent",
    "delivered",
    "read",
    "undelivered",
    "failed",
  ]);

const FAILURE_STATUSES =
  new Set([
    "failed",
    "undelivered",
  ]);

const STATUS_ORDER =
  new Map([
    ["received", 0],
    ["accepted", 10],
    ["queued", 20],
    ["sending", 30],
    ["sent", 40],
    ["delivered", 50],
    ["read", 60],
  ]);

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function statusRank(value) {
  return (
    STATUS_ORDER.get(
      text(value)
        .toLowerCase()
    ) ?? -1
  );
}

export function decideWhatsAppDeliveryStatusUpdate(
  currentValue,
  incomingValue
) {
  const currentStatus =
    text(currentValue)
      .toLowerCase();

  const incomingStatus =
    text(incomingValue)
      .toLowerCase();

  if (
    !CALLBACK_STATUSES.has(
      incomingStatus
    )
  ) {
    return {
      action: "ignore",
      reason:
        "unsupported_status",
    };
  }

  if (
    currentStatus ===
    incomingStatus
  ) {
    return {
      action: "ignore",
      reason: "duplicate",
    };
  }

  /*
   * A failure state is terminal in SalonAI.
   * Later delayed callbacks must not resurrect
   * the message into a success state.
   */
  if (
    FAILURE_STATUSES.has(
      currentStatus
    )
  ) {
    return {
      action: "ignore",
      reason:
        "terminal_status",
    };
  }

  const currentRank =
    statusRank(
      currentStatus
    );

  /*
   * "failed" occurs instead of "sent".
   * It is therefore only accepted before a
   * successful sent state has been recorded.
   */
  if (
    incomingStatus ===
    "failed"
  ) {
    if (
      currentRank >=
      statusRank("sent")
    ) {
      return {
        action: "ignore",
        reason:
          "status_regression",
      };
    }

    return {
      action: "update",
      reason:
        "failure",
    };
  }

  /*
   * "undelivered" follows an attempted send.
   * Once delivered/read is already recorded,
   * a delayed undelivered callback must not
   * overwrite that stronger success state.
   */
  if (
    incomingStatus ===
    "undelivered"
  ) {
    if (
      currentRank >=
      statusRank("delivered")
    ) {
      return {
        action: "ignore",
        reason:
          "status_regression",
      };
    }

    return {
      action: "update",
      reason:
        "delivery_failure",
    };
  }

  const incomingRank =
    statusRank(
      incomingStatus
    );

  if (
    incomingRank <=
    currentRank
  ) {
    return {
      action: "ignore",
      reason:
        "status_regression",
    };
  }

  return {
    action: "update",
    reason:
      "status_advanced",
  };
}

function matchingOutboundMessage(
  conversation,
  providerMessageId
) {
  const messages =
    Array.isArray(
      conversation?.messages
    )
      ? conversation.messages
      : [];

  return (
    messages.find(
      (message) =>
        message?.direction ===
          "outbound" &&
        text(
          message
            ?.providerMessageId
        ) ===
          providerMessageId
    ) || null
  );
}

function deliveryError(value) {
  return text(value)
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      1000
    );
}

function resultBase({
  providerMessageId,
  providerStatus,
}) {
  return {
    providerMessageId,
    providerStatus,
  };
}

export async function persistWhatsAppDeliveryStatus(
  event,
  {
    ConversationModel =
      WhatsAppConversation,
    maxAttempts = 3,
  } = {}
) {
  const providerMessageId =
    text(
      event
        ?.providerMessageId
    );

  const providerStatus =
    text(
      event
        ?.providerStatus
    ).toLowerCase();

  const base = resultBase({
    providerMessageId,
    providerStatus,
  });

  if (
    !providerMessageId ||
    !CALLBACK_STATUSES.has(
      providerStatus
    )
  ) {
    return {
      ...base,
      matched: false,
      updated: false,
      ignored: true,
      duplicate: false,
      reason:
        "invalid_status_callback",
      conversationId: null,
    };
  }

  let lastError = null;

  for (
    let attempt = 0;
    attempt < maxAttempts;
    attempt += 1
  ) {
    const conversation =
      await ConversationModel.findOne({
        messages: {
          $elemMatch: {
            direction:
              "outbound",
            providerMessageId,
          },
        },
      });

    if (!conversation) {
      return {
        ...base,
        matched: false,
        updated: false,
        ignored: true,
        duplicate: false,
        reason:
          "unknown_provider_message",
        conversationId: null,
      };
    }

    const message =
      matchingOutboundMessage(
        conversation,
        providerMessageId
      );

    if (!message) {
      return {
        ...base,
        matched: false,
        updated: false,
        ignored: true,
        duplicate: false,
        reason:
          "unknown_provider_message",
        conversationId:
          conversation._id
            ? String(
                conversation._id
              )
            : null,
      };
    }

    const decision =
      decideWhatsAppDeliveryStatusUpdate(
        message.providerStatus,
        providerStatus
      );

    if (
      decision.action !==
      "update"
    ) {
      return {
        ...base,
        matched: true,
        updated: false,
        ignored: true,
        duplicate:
          decision.reason ===
          "duplicate",
        reason:
          decision.reason,
        conversationId:
          conversation._id
            ? String(
                conversation._id
              )
            : null,
      };
    }

    message.providerStatus =
      providerStatus;

    if (
      FAILURE_STATUSES.has(
        providerStatus
      )
    ) {
      message.error =
        deliveryError(
          event?.error
        );
    } else {
      message.error = "";
    }

    try {
      await conversation.save();

      return {
        ...base,
        matched: true,
        updated: true,
        ignored: false,
        duplicate: false,
        reason:
          decision.reason,
        error:
          message.error || "",
        conversationId:
          conversation._id
            ? String(
                conversation._id
              )
            : null,
      };
    } catch (error) {
      lastError = error;

      /*
       * optimisticConcurrency is enabled on the
       * conversation model. If two callbacks race,
       * reload and evaluate the latest stored status.
       */
      if (
        error?.name ===
          "VersionError" &&
        attempt <
          maxAttempts - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ||
    new Error(
      "Unable to persist WhatsApp delivery status."
    );
}

export default {
  decideWhatsAppDeliveryStatusUpdate,
  persistWhatsAppDeliveryStatus,
};