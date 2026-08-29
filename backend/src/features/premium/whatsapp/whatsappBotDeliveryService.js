import Customer from "../../../models/customer.js";
import {
  sendWhatsApp,
} from "../../../providers/whatsappProvider.js";
import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  assertWhatsAppOutboundAllowed,
} from "./whatsappOutboundPolicy.js";


const ALLOWED_PROVIDER_STATUSES =
  new Set([
    "received",
    "accepted",
    "queued",
    "sending",
    "sent",
    "delivered",
    "read",
    "undelivered",
    "failed",
  ]);


function compactText(
  value,
  maximum
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}


function createDeliveryError(
  message,
  {
    statusCode = 400,
    code =
      "WHATSAPP_BOT_DELIVERY_ERROR",
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  return error;
}


function normaliseProviderStatus(
  value
) {
  const status =
    compactText(
      value,
      40
    ).toLowerCase();

  return ALLOWED_PROVIDER_STATUSES
    .has(status)
    ? status
    : "sent";
}


function customerAllowsServiceReply(
  customer
) {
  if (!customer) {
    return true;
  }

  return (
    customer
      ?.communicationPreferences
      ?.unsubscribed !== true
  );
}


async function defaultFindConversation(
  conversationId
) {
  return WhatsAppConversation
    .findById(
      conversationId
    );
}


async function defaultResolveCustomer(
  conversation
) {
  if (
    conversation?.customer
  ) {
    return Customer.findById(
      conversation.customer
    );
  }

  return Customer.findOne({
    $or: [
      {
        phone:
          conversation?.phone,
      },
      {
        alternativePhone:
          conversation?.phone,
      },
    ],
  });
}


async function defaultRecordReply({
  conversation,
  customer,
  body,
  delivery,
  now,
}) {
  const update = {
    $set: {
      lastMessageAt: now,
      lastOutboundAt: now,
      lastMessagePreview:
        body.slice(
          0,
          240
        ),
      "automation.lastReplyAt":
        now,
      ...(customer?._id
        ? {
            customer:
              customer._id,
          }
        : {}),
    },

    $push: {
      messages: {
        direction:
          "outbound",
        body,
        providerMessageId:
          compactText(
            delivery?.messageId,
            300
          ),
        providerStatus:
          normaliseProviderStatus(
            delivery?.status
          ),
        automationGenerated:
          true,
        sentAt: now,
      },
    },
  };

  if (
    conversation?.status ===
      "closed"
  ) {
    update.$set.status =
      "open";
    update.$set.closedAt =
      null;
  }

  return WhatsAppConversation
    .findByIdAndUpdate(
      conversation._id,
      update,
      {
        returnDocument:
          "after",
        runValidators: true,
      }
    );
}


export async function deliverWhatsAppBotReply(
  {
    conversationId,
    body,
  },
  {
    now = new Date(),
    findConversation =
      defaultFindConversation,
    resolveCustomer =
      defaultResolveCustomer,
    send =
      sendWhatsApp,
    recordReply =
      defaultRecordReply,
  } = {}
) {
  const message =
    compactText(
      body,
      4096
    );

  if (!message) {
    throw createDeliveryError(
      "A WhatsApp bot reply body is required.",
      {
        code:
          "WHATSAPP_BOT_REPLY_REQUIRED",
      }
    );
  }

  const conversation =
    await findConversation(
      conversationId
    );

  if (!conversation) {
    throw createDeliveryError(
      "WhatsApp conversation not found.",
      {
        statusCode: 404,
        code:
          "WHATSAPP_CONVERSATION_NOT_FOUND",
      }
    );
  }

  const customer =
    await resolveCustomer(
      conversation
    );

  if (
    !customerAllowsServiceReply(
      customer
    )
  ) {
    throw createDeliveryError(
      "The customer has opted out of WhatsApp messages.",
      {
        statusCode: 409,
        code:
          "WHATSAPP_CUSTOMER_OPTED_OUT",
      }
    );
  }

  const policy =
    assertWhatsAppOutboundAllowed({
      lastInboundAt:
        conversation.lastInboundAt ||
        null,
      now,
    });

  /*
   * Bot replies are intentionally free-form
   * service-window responses only. The AI bot
   * does not select or invent approved templates.
   * If the 24-hour window is closed, policy
   * enforcement rejects the delivery.
   */
  if (
    !policy.serviceWindowOpen
  ) {
    throw createDeliveryError(
      "Automated WhatsApp replies require an open customer service window.",
      {
        statusCode: 409,
        code:
          "WHATSAPP_BOT_SERVICE_WINDOW_CLOSED",
      }
    );
  }

  const delivery =
    await send({
      to:
        conversation.phone,
      message,
    });

  const saved =
    await recordReply({
      conversation,
      customer,
      body: message,
      delivery,
      now,
    });

  return {
    saved,
    delivery,
    policy,
  };
}


export default {
  deliverWhatsAppBotReply,
};
