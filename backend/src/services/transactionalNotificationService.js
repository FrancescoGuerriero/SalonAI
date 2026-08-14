import Customer from "../models/customer.js";
import TransactionalNotificationEvent from "../models/TransactionalNotificationEvent.js";
import { deliverAndRecordMessage } from "./messageDeliveryRecordService.js";
import { sendWhatsApp } from "../providers/whatsappProvider.js";
import WhatsAppConversation from "../features/premium/whatsapp/WhatsAppConversation.js";
import { normaliseWhatsAppPhone } from "../features/premium/whatsapp/whatsappService.js";
import {
  assertWhatsAppOutboundAllowed,
  normaliseTemplateVariables,
} from "../features/premium/whatsapp/whatsappOutboundPolicy.js";

const SUPPORTED_CHANNELS = new Set(["email", "sms", "whatsapp"]);

function text(value) {
  return String(value ?? "").trim();
}

function normaliseChannels(channels) {
  const values = Array.isArray(channels) ? channels : [channels];
  const output = [];

  for (const value of values) {
    const channel = text(value).toLowerCase();
    if (!channel) continue;
    if (!SUPPORTED_CHANNELS.has(channel)) {
      const error = new Error(`Unsupported transactional notification channel: ${channel}.`);
      error.statusCode = 400;
      error.code = "TRANSACTIONAL_NOTIFICATION_CHANNEL_INVALID";
      throw error;
    }
    if (!output.includes(channel)) output.push(channel);
  }

  if (output.length === 0) {
    const error = new Error("At least one transactional notification channel is required.");
    error.statusCode = 400;
    error.code = "TRANSACTIONAL_NOTIFICATION_CHANNEL_REQUIRED";
    throw error;
  }

  return output;
}

function customerAllowsTransactionalMessage(customer, channel) {
  if (!customer) return true;

  const preferences = customer.communicationPreferences || {};
  if (preferences.unsubscribed === true) return false;
  if (channel === "email" && preferences.emailUnsubscribed === true) return false;
  if (channel === "sms" && preferences.smsUnsubscribed === true) return false;

  return true;
}

function auditWhatsAppBody({ body, contentSid }) {
  return body || `WhatsApp template ${contentSid}`;
}

function providerStatus(value) {
  const allowed = new Set([
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
  const status = text(value).toLowerCase();
  return allowed.has(status) ? status : "sent";
}

async function findCustomer(customerId, recipient) {
  if (customerId) {
    const byId = await Customer.findById(customerId);
    if (byId) return byId;
  }

  const email = text(recipient?.email).toLowerCase();
  const phone = text(recipient?.phone);
  const conditions = [];
  if (email) conditions.push({ email });
  if (phone) {
    conditions.push({ phone });
    conditions.push({ alternativePhone: phone });
  }

  return conditions.length ? Customer.findOne({ $or: conditions }) : null;
}

async function claimNotificationEvent({ eventKey, event, channels, metadata }) {
  const key = text(eventKey);
  if (!key) return { record: null, duplicate: false };

  try {
    const record = await TransactionalNotificationEvent.create({
      eventKey: key,
      event,
      requestedChannels: channels,
      status: "processing",
      metadata,
    });
    return { record, duplicate: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const record = await TransactionalNotificationEvent.findOne({ eventKey: key }).lean();
    return { record, duplicate: true };
  }
}

function summariseChannelResult(result) {
  const providerResult = result?.result?.result || result?.result?.delivery || null;
  return {
    channel: result?.channel || "",
    success: Boolean(result?.success),
    skipped: Boolean(result?.skipped),
    reason: result?.reason || "",
    provider: providerResult?.provider || null,
    providerMessageId:
      providerResult?.providerMessageId ||
      providerResult?.messageId ||
      result?.result?.result?.messageId ||
      null,
    status:
      providerResult?.status ||
      result?.result?.result?.status ||
      null,
    error: result?.error || null,
  };
}

async function completeNotificationEvent(record, summary) {
  if (!record) return;

  record.successful = summary.successful;
  record.skipped = summary.skipped;
  record.failed = summary.failed;
  record.results = summary.results.map(summariseChannelResult);
  record.status = summary.failed === 0
    ? "completed"
    : summary.successful > 0 || summary.skipped > 0
      ? "partial"
      : "failed";
  record.completedAt = new Date();
  await record.save();
}

async function sendRecordedEmail({ recipient, subject, textBody, html, metadata, customer, actorId }) {
  if (!recipient.email) {
    return { channel: "email", success: false, skipped: true, reason: "recipient_missing" };
  }

  if (!customerAllowsTransactionalMessage(customer, "email")) {
    return { channel: "email", success: false, skipped: true, reason: "customer_opted_out" };
  }

  const result = await deliverAndRecordMessage(
    {
      channel: "email",
      to: recipient.email,
      recipient: { name: recipient.name, email: recipient.email },
      subject,
      text: textBody,
      html,
      customer: customer?._id || null,
      metadata,
      consent: {
        required: false,
        checked: true,
        granted: true,
        source: "transactional_service_message",
      },
    },
    {
      customerId: customer?._id || null,
      createdBy: actorId || null,
      updatedBy: actorId || null,
      requireConsent: false,
      metadata,
      deferRetries: true,
    }
  );

  return { channel: "email", success: true, result };
}

async function sendRecordedSms({ recipient, textBody, metadata, customer, actorId }) {
  if (!recipient.phone) {
    return { channel: "sms", success: false, skipped: true, reason: "recipient_missing" };
  }

  if (!customerAllowsTransactionalMessage(customer, "sms")) {
    return { channel: "sms", success: false, skipped: true, reason: "customer_opted_out" };
  }

  const result = await deliverAndRecordMessage(
    {
      channel: "sms",
      to: recipient.phone,
      recipient: { name: recipient.name, phone: recipient.phone },
      body: textBody,
      customer: customer?._id || null,
      metadata,
      consent: {
        required: false,
        checked: true,
        granted: true,
        source: "transactional_service_message",
      },
    },
    {
      customerId: customer?._id || null,
      createdBy: actorId || null,
      updatedBy: actorId || null,
      requireConsent: false,
      metadata,
      deferRetries: true,
    }
  );

  return { channel: "sms", success: true, result };
}

async function sendRecordedWhatsApp({
  recipient,
  textBody,
  contentSid,
  contentVariables,
  metadata,
  customer,
  actorId,
}) {
  if (!recipient.phone) {
    return { channel: "whatsapp", success: false, skipped: true, reason: "recipient_missing" };
  }

  if (!customerAllowsTransactionalMessage(customer, "whatsapp")) {
    return { channel: "whatsapp", success: false, skipped: true, reason: "customer_opted_out" };
  }

  const phone = normaliseWhatsAppPhone(recipient.phone);
  const conversation = await WhatsAppConversation.findOne({ phone });
  const policy = assertWhatsAppOutboundAllowed({
    lastInboundAt: conversation?.lastInboundAt || null,
    contentSid: text(contentSid),
  });

  const body = text(textBody).replace(/\s+/g, " ");
  if (!policy.templateSupplied && !body) {
    const error = new Error("A WhatsApp message body is required during an open customer service window.");
    error.statusCode = 400;
    error.code = "WHATSAPP_MESSAGE_BODY_REQUIRED";
    throw error;
  }

  const variables = normaliseTemplateVariables(contentVariables);
  const delivery = await sendWhatsApp({
    to: phone,
    message: body,
    contentSid: policy.contentSid,
    contentVariables: variables,
    statusCallbackUrl: process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL || "",
  });

  const now = new Date();
  const auditBody = auditWhatsAppBody({ body, contentSid: policy.contentSid });
  const update = {
    $set: {
      lastMessageAt: now,
      lastOutboundAt: now,
      lastMessagePreview: auditBody.slice(0, 240),
      ...(recipient.name ? { displayName: recipient.name.slice(0, 120) } : {}),
      ...(customer ? { customer: customer._id } : {}),
      ...(actorId ? { assignedTo: actorId } : {}),
      ...(conversation?.status === "closed" ? { status: "open", closedAt: null } : {}),
    },
    $setOnInsert: {
      phone,
      status: "open",
      unreadCount: 0,
    },
    $push: {
      messages: {
        direction: "outbound",
        body: auditBody,
        providerMessageId: delivery?.messageId || "",
        providerStatus: providerStatus(delivery?.status),
        sentAt: now,
      },
    },
  };

  const saved = await WhatsAppConversation.findOneAndUpdate(
    { phone },
    update,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return {
    channel: "whatsapp",
    success: true,
    result: {
      delivery,
      policy,
      conversationId: saved._id,
      metadata,
    },
  };
}

export async function sendTransactionalNotification({
  event,
  eventKey = "",
  channels = ["email"],
  recipient = {},
  subject = "",
  text: textBody = "",
  html = "",
  whatsapp = {},
  customerId = null,
  actorId = null,
  metadata = {},
} = {}) {
  const selectedChannels = normaliseChannels(channels);
  const safeRecipient = {
    name: text(recipient.name),
    email: text(recipient.email).toLowerCase(),
    phone: text(recipient.phone),
  };

  const eventName = text(event) || "transactional.notification";
  const commonMetadata = {
    ...metadata,
    notificationEvent: eventName,
    notificationEventKey: text(eventKey) || undefined,
    transactional: true,
  };

  const claim = await claimNotificationEvent({
    eventKey,
    event: eventName,
    channels: selectedChannels,
    metadata: commonMetadata,
  });

  if (claim.duplicate) {
    return {
      success: true,
      duplicate: true,
      skipped: true,
      event: eventName,
      eventKey: text(eventKey),
      previousStatus: claim.record?.status || null,
      requestedChannels: selectedChannels,
      successful: claim.record?.successful || 0,
      failed: claim.record?.failed || 0,
      results: claim.record?.results || [],
    };
  }

  const customer = await findCustomer(customerId, safeRecipient);
  const results = [];

  for (const channel of selectedChannels) {
    try {
      if (channel === "email") {
        results.push(await sendRecordedEmail({
          recipient: safeRecipient,
          subject: text(subject),
          textBody: text(textBody),
          html: text(html),
          metadata: commonMetadata,
          customer,
          actorId,
        }));
      } else if (channel === "sms") {
        results.push(await sendRecordedSms({
          recipient: safeRecipient,
          textBody: text(textBody),
          metadata: commonMetadata,
          customer,
          actorId,
        }));
      } else {
        results.push(await sendRecordedWhatsApp({
          recipient: safeRecipient,
          textBody: text(whatsapp.body || textBody),
          contentSid: whatsapp.contentSid,
          contentVariables: whatsapp.contentVariables,
          metadata: commonMetadata,
          customer,
          actorId,
        }));
      }
    } catch (error) {
      results.push({
        channel,
        success: false,
        skipped: false,
        error: {
          message: error?.message || "Transactional notification delivery failed.",
          code: error?.code || "TRANSACTIONAL_NOTIFICATION_FAILED",
          statusCode: error?.statusCode || 500,
          retryable: Boolean(error?.retryable),
        },
      });
    }
  }

  const successful = results.filter((result) => result.success).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.length - successful - skipped;

  const summary = {
    success: failed === 0,
    duplicate: false,
    event: eventName,
    eventKey: text(eventKey) || null,
    requestedChannels: selectedChannels,
    successful,
    skipped,
    failed,
    results,
    sentAt: new Date().toISOString(),
  };

  await completeNotificationEvent(claim.record, summary);
  return summary;
}

export default {
  sendTransactionalNotification,
};
