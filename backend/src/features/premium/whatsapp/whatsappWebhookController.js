import WhatsAppConversation from "./WhatsAppConversation.js";

import {
  normaliseWhatsAppWebhookMessages,
  verifyMetaWebhookSubscription,
  verifyWhatsAppWebhookRequest,
} from "../../../providers/whatsapp/whatsappWebhookAdapter.js";

function createHttpError(
  message,
  statusCode = 500
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;

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

async function saveIncomingMessage(
  incoming
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

  const now = new Date();

  const conversation =
    await WhatsAppConversation.findOneAndUpdate(
      {
        phone: incoming.phone,
      },
      {
        $set: {
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
            direction: "inbound",
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
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

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

  if (!verification.verified) {
    throw createHttpError(
      "The WhatsApp webhook verification request is invalid.",
      403
    );
  }

  /*
   * Meta documents hub.challenge as a numeric
   * verification challenge. Convert it to a number
   * before reflecting it so arbitrary request text
   * can never reach the HTTP response body.
   */
  const challengeText =
    String(
      verification.challenge || ""
    ).trim();

  if (
    !/^\d+$/.test(challengeText)
  ) {
    throw createHttpError(
      "The WhatsApp webhook challenge is invalid.",
      400
    );
  }

  const challenge =
    Number(challengeText);

  if (
    !Number.isSafeInteger(challenge) ||
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

  const messages =
    normaliseWhatsAppWebhookMessages(
      request
    );

  /*
   * Meta also sends delivery/read/status callbacks
   * to the same webhook. These are valid events,
   * even when they contain no inbound text message.
   */
  if (messages.length === 0) {
    return response.json({
      success: true,
      ignored: true,
      processed: 0,
      duplicates: 0,
    });
  }

  let processed = 0;
  let duplicates = 0;
  let conversationId = null;

  for (const incoming of messages) {
    const result =
      await saveIncomingMessage(
        incoming
      );

    conversationId =
      result.conversationId;

    if (result.duplicate) {
      duplicates += 1;
    } else {
      processed += 1;
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
