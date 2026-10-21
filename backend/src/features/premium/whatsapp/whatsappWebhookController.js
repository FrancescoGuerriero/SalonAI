import WhatsAppConversation from "./WhatsAppConversation.js";

import {
  normaliseWhatsAppWebhookDeliveryStatus,
  normaliseWhatsAppWebhookMessages,
  verifyMetaWebhookSubscription,
  verifyWhatsAppWebhookRequest,
} from "../../../providers/whatsapp/whatsappWebhookAdapter.js";

import {
  persistWhatsAppDeliveryStatus,
} from "./whatsappDeliveryStatusService.js";

import {
  queueWhatsAppBotMessage,
} from "./whatsappBotRuntime.js";
import {
  resolveWhatsAppTenantContext,
} from "./whatsappTenantContextService.js";

function createHttpError(
  message,
  statusCode = 500
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;

  return error;
}

async function existingMessage(
  providerMessageId
) {
  if (!providerMessageId) {
    return null;
  }

  return WhatsAppConversation.findOne({
    "messages.providerMessageId":
      providerMessageId,
  }).select("_id");
}

function tenantScope(tenantContext) {
  return tenantContext
    ? {
        business: tenantContext.business,
        location: tenantContext.location,
      }
    : {};
}

export function buildReusableWhatsAppConversationFilter(
  phone,
  tenantContext = null
) {
  return {
    phone,
    ...tenantScope(tenantContext),

    "bookingSession.appointmentId":
      null,

    "bookingSession.confirmed": {
      $ne: true,
    },

    "bookingSession.confirmationState": {
      $ne: "completed",
    },

    "bookingSession.stage": {
      $ne: "confirmed",
    },
  };
}


async function saveIncomingMessage(
  incoming,
  tenantContext = null
) {
  const duplicate =
    await existingMessage(
      incoming.providerMessageId
    );

  if (duplicate) {
    return {
      duplicate: true,
      conversationId:
        duplicate._id,
    };
  }

  const now =
    new Date();
  const scope =
    tenantScope(tenantContext);

  const latestConversation =
    await WhatsAppConversation
      .findOne({
        phone:
          incoming.phone,
        ...scope,
      })
      .sort({
        lastMessageAt: -1,
        createdAt: -1,
      })
      .select(
        "_id business location customer displayName " +
        "bookingSession.appointmentId " +
        "bookingSession.confirmed " +
        "bookingSession.confirmationState " +
        "bookingSession.stage"
      )
      .lean();

  let conversation = null;

  /*
   * Only the latest conversation in the trusted channel scope may be reused.
   * An older unfinished conversation must never be revived after a newer
   * booking has already completed.
   */
  if (latestConversation) {
    conversation =
      await WhatsAppConversation.findOneAndUpdate(
        {
          ...buildReusableWhatsAppConversationFilter(
            incoming.phone,
            tenantContext
          ),

          _id:
            latestConversation._id,
        },
      {
        $set: {
          ...scope,
          ...(incoming.displayName
            ? {
                displayName:
                  incoming.displayName,
              }
            : {}),

          lastMessageAt: now,
          lastInboundAt: now,
          lastMessagePreview:
            incoming.message.slice(
              0,
              240
            ),
          status: "open",
        },

        $inc: {
          unreadCount: 1,
        },

        $push: {
          messages: {
            direction:
              "inbound",

            body:
              incoming.message,

            providerMessageId:
              incoming.providerMessageId,

            providerStatus:
              "received",

            sentAt: now,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );
  }

  /*
   * A completed booking belongs to its historical WhatsApp conversation.
   * The next inbound customer message starts a new conversation with the
   * same trusted channel ownership when a provider binding is configured.
   */
  if (!conversation) {
    conversation =
      await WhatsAppConversation.create({
        ...scope,
        customer:
          latestConversation?.customer ||
          null,

        phone:
          incoming.phone,

        displayName:
          incoming.displayName ||
          latestConversation?.displayName ||
          "",

        status:
          "open",

        lastMessageAt:
          now,

        lastInboundAt:
          now,

        lastMessagePreview:
          incoming.message.slice(
            0,
            240
          ),

        unreadCount:
          1,

        messages: [
          {
            direction:
              "inbound",

            body:
              incoming.message,

            providerMessageId:
              incoming.providerMessageId,

            providerStatus:
              "received",

            sentAt:
              now,
          },
        ],
      });
  }

  return {
    duplicate: false,
    conversationId:
      conversation._id,
  };
}

export async function verifyWebhookSubscription(
  request,
  response
) {
  const verification =
    verifyMetaWebhookSubscription(
      request.query || {}
    );

  if (
    !verification.verified
  ) {
    throw createHttpError(
      "The WhatsApp webhook verification request is invalid.",
      403
    );
  }

  /*
   * Meta documents hub.challenge as a numeric verification challenge.
   * Convert it to a number before reflecting it so arbitrary request text
   * can never reach the HTTP response body.
   */
  const challengeText =
    String(
      verification.challenge ||
        ""
    ).trim();

  if (
    !/^\d+$/.test(
      challengeText
    )
  ) {
    throw createHttpError(
      "The WhatsApp webhook challenge is invalid.",
      400
    );
  }

  const challenge =
    Number(
      challengeText
    );

  if (
    !Number.isSafeInteger(
      challenge
    ) ||
    challenge < 0
  ) {
    throw createHttpError(
      "The WhatsApp webhook challenge is invalid.",
      400
    );
  }

  response.status(200);

  response.set(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  return response.end(
    String(challenge)
  );
}

export async function receiveWebhook(
  request,
  response
) {
  if (
    !verifyWhatsAppWebhookRequest(
      request
    )
  ) {
    throw createHttpError(
      "The WhatsApp webhook signature is invalid.",
      403
    );
  }

  /*
   * Twilio sends outbound message status callbacks to the same public
   * webhook endpoint used for inbound WhatsApp messages.
   */
  const deliveryStatus =
    normaliseWhatsAppWebhookDeliveryStatus(
      request
    );

  if (deliveryStatus) {
    const result =
      await persistWhatsAppDeliveryStatus(
        deliveryStatus
      );

    return response.json({
      success: true,
      statusCallback: true,

      processed:
        result.updated
          ? 1
          : 0,

      ignored:
        result.ignored,

      duplicate:
        result.duplicate,

      reason:
        result.reason,

      providerMessageId:
        result.providerMessageId,

      providerStatus:
        result.providerStatus,

      conversationId:
        result.conversationId,
    });
  }

  const messages =
    normaliseWhatsAppWebhookMessages(
      request
    );

  /*
   * Meta also sends delivery/read/status callbacks to the same webhook.
   * Unsupported callback types are acknowledged safely so providers do not
   * retry them unnecessarily.
   */
  if (
    messages.length === 0
  ) {
    return response.json({
      success: true,
      ignored: true,
      processed: 0,
      duplicates: 0,
    });
  }

  const tenantContext =
    await resolveWhatsAppTenantContext(
      request
    );

  let processed = 0;
  let duplicates = 0;
  let conversationId =
    null;

  for (
    const incoming of
    messages
  ) {
    const result =
      await saveIncomingMessage(
        incoming,
        tenantContext
      );

    conversationId =
      result.conversationId;

    if (
      result.duplicate
    ) {
      duplicates += 1;
    } else {
      processed += 1;

      /*
       * Automation is scheduled only after the signed inbound message has
       * been safely persisted and deduplicated. The queue is deliberately
       * not awaited so provider webhook acknowledgement remains prompt.
       */
      void queueWhatsAppBotMessage({
        conversationId:
          result.conversationId,
        incoming,
      });
    }
  }

  return response.json({
    success: true,

    duplicate:
      processed === 0 &&
      duplicates > 0,

    processed,
    duplicates,
    conversationId,
  });
}

export default {
  receiveWebhook,
  verifyWebhookSubscription,
};
