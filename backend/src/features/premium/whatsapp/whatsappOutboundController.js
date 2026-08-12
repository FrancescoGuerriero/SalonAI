import mongoose from "mongoose";

import Customer from "../../../models/customer.js";
import {
  sendWhatsApp,
} from "../../../providers/whatsappProvider.js";
import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  normaliseWhatsAppPhone,
} from "./whatsappService.js";
import {
  assertWhatsAppOutboundAllowed,
  evaluateWhatsAppOutboundPolicy,
  normaliseTemplateVariables,
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

function createHttpError(
  message,
  statusCode = 400,
  code =
    "WHATSAPP_OUTBOUND_ERROR",
  details = null
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;
  error.code = code;
  error.details = details;

  return error;
}

function normaliseBody(value) {
  const body =
    String(value || "")
      .trim()
      .replace(/\s+/g, " ");

  if (
    body.length > 4096
  ) {
    throw createHttpError(
      "WhatsApp messages cannot exceed 4096 characters.",
      400,
      "WHATSAPP_MESSAGE_TOO_LONG",
      {
        field: "body",
      }
    );
  }

  return body;
}

function normaliseProviderStatus(
  value
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  return ALLOWED_PROVIDER_STATUSES
    .has(status)
    ? status
    : "sent";
}

function auditBody({
  body,
  contentSid,
}) {
  if (body) {
    return body;
  }

  return `WhatsApp template ${contentSid}`;
}

function customerAllowsMessage(
  customer,
  {
    purpose = "service",
  } = {}
) {
  if (!customer) {
    return true;
  }

  const preferences =
    customer
      .communicationPreferences ||
    {};

  if (
    preferences
      .unsubscribed === true
  ) {
    return false;
  }

  if (
    purpose === "marketing" &&
    preferences
      .promotionalMessages ===
      false
  ) {
    return false;
  }

  return true;
}

async function resolveCustomerByPhone(
  phone
) {
  return Customer.findOne({
    $or: [
      {
        phone,
      },
      {
        alternativePhone:
          phone,
      },
    ],
  });
}

async function populatedConversation(
  conversationId
) {
  return WhatsAppConversation
    .findById(
      conversationId
    )
    .populate(
      "customer",
      "firstName lastName preferredName phone email communicationPreferences"
    )
    .populate(
      "assignedTo",
      "name email role"
    )
    .populate(
      "bookingSession.serviceId",
      "name category price duration"
    )
    .populate(
      "bookingSession.stylistId",
      "firstName lastName"
    )
    .lean();
}

function outboundPayload(
  requestBody,
  conversation
) {
  const body =
    normaliseBody(
      requestBody?.body
    );

  const contentSid =
    String(
      requestBody
        ?.contentSid ||
        ""
    ).trim();

  const policy =
    assertWhatsAppOutboundAllowed({
      lastInboundAt:
        conversation
          ?.lastInboundAt ||
        null,
      contentSid,
    });

  const contentVariables =
    normaliseTemplateVariables(
      requestBody
        ?.contentVariables
    );

  if (
    !policy
      .templateSupplied &&
    !body
  ) {
    throw createHttpError(
      "A WhatsApp message body is required during an open customer service window.",
      400,
      "WHATSAPP_MESSAGE_BODY_REQUIRED",
      {
        field: "body",
      }
    );
  }

  return {
    body,
    contentSid:
      policy.contentSid,
    contentVariables,
    policy,
  };
}

async function deliverAndRecord({
  conversation,
  phone,
  requestBody,
  actorId,
  displayName = "",
  customer = null,
}) {
  const payload =
    outboundPayload(
      requestBody,
      conversation
    );

  const delivery =
    await sendWhatsApp({
      to: phone,
      message:
        payload.body,
      contentSid:
        payload.contentSid,
      contentVariables:
        payload
          .contentVariables,
    });

  const now =
    new Date();

  const messageBody =
    auditBody({
      body: payload.body,
      contentSid:
        payload.contentSid,
    });

  const update = {
    $set: {
      lastMessageAt: now,
      lastOutboundAt: now,
      lastMessagePreview:
        messageBody.slice(
          0,
          240
        ),
      ...(displayName
        ? {
            displayName,
          }
        : {}),
      ...(customer
        ? {
            customer:
              customer._id,
          }
        : {}),
      ...(actorId
        ? {
            assignedTo:
              actorId,
          }
        : {}),
    },
    $push: {
      messages: {
        direction:
          "outbound",
        body: messageBody,
        providerMessageId:
          delivery
            ?.messageId ||
          "",
        providerStatus:
          normaliseProviderStatus(
            delivery
              ?.status
          ),
        sentAt: now,
      },
    },
  };

  if (
    conversation
      ?.status === "closed"
  ) {
    update.$set.status =
      "open";
    update.$set.closedAt =
      null;
  }

  const saved =
    conversation
      ? await WhatsAppConversation.findByIdAndUpdate(
          conversation._id,
          update,
          {
            new: true,
            runValidators:
              true,
          }
        )
      : await WhatsAppConversation.findOneAndUpdate(
          {
            phone,
          },
          {
            ...update,
            $setOnInsert: {
              phone,
              status:
                "open",
              unreadCount:
                0,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators:
              true,
            setDefaultsOnInsert:
              true,
          }
        );

  return {
    saved,
    delivery,
    policy:
      payload.policy,
  };
}

export async function sendConversationMessageWithPolicy(
  request,
  response
) {
  const conversationId =
    String(
      request.params
        .conversationId ||
        ""
    ).trim();

  if (
    !mongoose.isValidObjectId(
      conversationId
    )
  ) {
    throw createHttpError(
      "The WhatsApp conversation identifier is invalid.",
      400,
      "WHATSAPP_CONVERSATION_ID_INVALID"
    );
  }

  const conversation =
    await WhatsAppConversation
      .findById(
        conversationId
      );

  if (!conversation) {
    throw createHttpError(
      "WhatsApp conversation not found.",
      404,
      "WHATSAPP_CONVERSATION_NOT_FOUND"
    );
  }

  const customer =
    conversation.customer
      ? await Customer.findById(
          conversation.customer
        )
      : await resolveCustomerByPhone(
          conversation.phone
        );

  const purpose =
    String(
      request.body
        ?.purpose ||
        "service"
    )
      .trim()
      .toLowerCase();

  if (
    !customerAllowsMessage(
      customer,
      {
        purpose,
      }
    )
  ) {
    throw createHttpError(
      "The customer has opted out of this message type.",
      409,
      "WHATSAPP_CUSTOMER_OPTED_OUT"
    );
  }

  const result =
    await deliverAndRecord({
      conversation,
      phone:
        conversation.phone,
      requestBody:
        request.body || {},
      actorId:
        request.user?._id,
      customer,
    });

  return response.json({
    success: true,
    message:
      result.policy
        .templateSupplied
        ? "WhatsApp template sent."
        : "WhatsApp message sent.",
    delivery:
      result.delivery,
    policy:
      result.policy,
    conversation:
      await populatedConversation(
        result.saved._id
      ),
  });
}

export async function createOutboundWhatsAppMessage(
  request,
  response
) {
  const phone =
    normaliseWhatsAppPhone(
      request.body?.to
    );

  const consentConfirmed =
    request.body
      ?.consentConfirmed ===
      true;

  if (
    !consentConfirmed
  ) {
    throw createHttpError(
      "Confirm that the customer has consented to receive this WhatsApp message.",
      400,
      "WHATSAPP_CONSENT_CONFIRMATION_REQUIRED",
      {
        field:
          "consentConfirmed",
      }
    );
  }

  const displayName =
    String(
      request.body
        ?.displayName ||
        ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120);

  const [
    conversation,
    customer,
  ] = await Promise.all([
    WhatsAppConversation.findOne({
      phone,
    }),
    resolveCustomerByPhone(
      phone
    ),
  ]);

  const purpose =
    String(
      request.body
        ?.purpose ||
        "service"
    )
      .trim()
      .toLowerCase();

  if (
    !customerAllowsMessage(
      customer,
      {
        purpose,
      }
    )
  ) {
    throw createHttpError(
      "The customer has opted out of this message type.",
      409,
      "WHATSAPP_CUSTOMER_OPTED_OUT"
    );
  }

  const result =
    await deliverAndRecord({
      conversation,
      phone,
      requestBody:
        request.body || {},
      actorId:
        request.user?._id,
      displayName,
      customer,
    });

  return response
    .status(201)
    .json({
      success: true,
      message:
        result.policy
          .templateSupplied
          ? "One-off WhatsApp template sent."
          : "One-off WhatsApp message sent.",
      delivery:
        result.delivery,
      policy:
        result.policy,
      conversation:
        await populatedConversation(
          result.saved._id
        ),
    });
}

export async function getWhatsAppOutboundPolicy(
  request,
  response
) {
  const phone =
    normaliseWhatsAppPhone(
      request.query?.to
    );

  const conversation =
    await WhatsAppConversation.findOne({
      phone,
    })
      .select(
        "phone lastInboundAt lastOutboundAt"
      )
      .lean();

  const policy =
    evaluateWhatsAppOutboundPolicy({
      lastInboundAt:
        conversation
          ?.lastInboundAt ||
        null,
      contentSid:
        "",
    });

  return response.json({
    success: true,
    phone,
    lastInboundAt:
      conversation
        ?.lastInboundAt ||
      null,
    ...policy,
  });
}

export default {
  createOutboundWhatsAppMessage,
  getWhatsAppOutboundPolicy,
  sendConversationMessageWithPolicy,
};
