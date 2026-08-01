import Appointment from "../../models/Appointment.js";

import RebookingCampaign from "./RebookingCampaign.js";

import {
  addDays,
  clampInteger,
  getAppointmentDate,
  getAppointmentValue,
  getEntityId,
  roundMoney,
  toValidDate,
} from "../shared/analyticsUtils.js";

const ACTIVE_BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);

function sanitiseRecipient(recipient) {
  return {
    customer: recipient?.customerId || recipient?.customer || null,
    name: String(recipient?.name || "").trim(),
    email: String(recipient?.email || "").trim().toLowerCase(),
    phone: String(recipient?.phone || "").trim(),
    service: recipient?.serviceId || recipient?.service || null,
    serviceName: String(recipient?.serviceName || "").trim(),
    estimatedRevenue: roundMoney(recipient?.estimatedRevenue),
    priority: ["high", "medium", "low"].includes(recipient?.priority)
      ? recipient.priority
      : "medium",
    sourceStatus: ["completed", "cancelled", "no_show", "manual"].includes(
      recipient?.sourceStatus
    )
      ? recipient.sourceStatus
      : "manual",
    status: "draft",
  };
}

async function listRebookingCampaigns({
  page = 1,
  limit = 20,
  status,
} = {}) {
  const selectedPage = clampInteger(page, 1, 100000, 1);
  const selectedLimit = clampInteger(limit, 1, 100, 20);
  const query = {};

  if (["draft", "scheduled", "queued", "sent", "cancelled"].includes(status)) {
    query.status = status;
  }

  const [campaigns, total] = await Promise.all([
    RebookingCampaign.find(query)
      .sort({ createdAt: -1 })
      .skip((selectedPage - 1) * selectedLimit)
      .limit(selectedLimit)
      .lean(),
    RebookingCampaign.countDocuments(query),
  ]);

  return {
    campaigns,
    pagination: {
      page: selectedPage,
      limit: selectedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / selectedLimit)),
    },
  };
}

async function getRebookingCampaign(campaignId) {
  const campaign = await RebookingCampaign.findById(campaignId).lean();

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  return campaign;
}

async function createRebookingCampaign(payload, actor = {}) {
  const recipients = Array.isArray(payload?.recipients)
    ? payload.recipients.map(sanitiseRecipient)
    : [];

  if (!String(payload?.name || "").trim()) {
    const error = new Error("Campaign name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["email", "sms"].includes(payload?.channel)) {
    const error = new Error("Campaign channel must be email or SMS.");
    error.statusCode = 400;
    throw error;
  }

  if (!String(payload?.message || "").trim()) {
    const error = new Error("Campaign message is required.");
    error.statusCode = 400;
    throw error;
  }

  const campaign = await RebookingCampaign.create({
    name: String(payload.name).trim(),
    channel: payload.channel,
    subject: String(payload.subject || "").trim(),
    message: String(payload.message).trim(),
    duplicateWindowDays: clampInteger(
      payload.duplicateWindowDays,
      0,
      365,
      30
    ),
    recipients,
    createdBy: actor.userId || null,
  });

  return campaign.toObject();
}

async function updateRebookingCampaign(campaignId, payload) {
  const campaign = await RebookingCampaign.findById(campaignId);

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!["draft", "scheduled"].includes(campaign.status)) {
    const error = new Error("Only draft or scheduled campaigns can be edited.");
    error.statusCode = 409;
    throw error;
  }

  const editableFields = [
    "name",
    "channel",
    "subject",
    "message",
    "duplicateWindowDays",
  ];

  for (const field of editableFields) {
    if (payload?.[field] !== undefined) {
      campaign[field] = payload[field];
    }
  }

  if (Array.isArray(payload?.recipients)) {
    campaign.recipients = payload.recipients.map(sanitiseRecipient);
  }

  await campaign.save();
  return campaign.toObject();
}

async function scheduleRebookingCampaign(campaignId, scheduleAt) {
  const campaign = await RebookingCampaign.findById(campaignId);

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  const scheduleDate = toValidDate(scheduleAt);

  if (!scheduleDate || scheduleDate <= new Date()) {
    const error = new Error("A future schedule date is required.");
    error.statusCode = 400;
    throw error;
  }

  campaign.scheduleAt = scheduleDate;
  campaign.status = "scheduled";
  campaign.recipients.forEach((recipient) => {
    if (recipient.status === "draft") {
      recipient.status = "scheduled";
    }
  });

  await campaign.save();
  return campaign.toObject();
}

async function loadDeliveryAdapter() {
  const candidates = [
    "../../services/messageDeliveryService.js",
    "../../messageDelivery/messageDeliveryService.js",
    "../../realMessageDelivery/messageDeliveryService.js",
  ];

  for (const candidate of candidates) {
    try {
      const module = await import(candidate);
      const send =
        module.queueMessage ||
        module.sendMessage ||
        module.deliverMessage ||
        module.default?.queueMessage ||
        module.default?.sendMessage ||
        module.default?.deliverMessage;

      if (typeof send === "function") {
        return send;
      }
    } catch {
      // Continue to the next optional adapter.
    }
  }

  return null;
}

async function findRecentDuplicate({ campaign, recipient }) {
  const customerId = getEntityId(recipient.customer);

  if (!customerId || campaign.duplicateWindowDays <= 0) {
    return false;
  }

  const cutoff = addDays(new Date(), -campaign.duplicateWindowDays);

  const duplicate = await RebookingCampaign.exists({
    _id: { $ne: campaign._id },
    createdAt: { $gte: cutoff },
    status: { $in: ["queued", "sent"] },
    recipients: {
      $elemMatch: {
        customer: customerId,
        status: { $in: ["queued", "sent", "delivered"] },
      },
    },
  });

  return Boolean(duplicate);
}

async function dispatchRecipient({ campaign, recipient, adapter }) {
  const destination =
    campaign.channel === "email" ? recipient.email : recipient.phone;

  if (!destination) {
    return {
      status: "failed",
      errorMessage: `Recipient has no ${campaign.channel} destination.`,
    };
  }

  if (await findRecentDuplicate({ campaign, recipient })) {
    return {
      status: "failed",
      errorMessage: "Duplicate-contact window is still active.",
    };
  }

  if (!adapter) {
    return {
      status: "queued",
      errorMessage: "No compatible delivery adapter was found; message retained in queue.",
    };
  }

  try {
    const result = await adapter({
      channel: campaign.channel,
      to: destination,
      subject: campaign.subject,
      body: campaign.message,
      metadata: {
        campaignId: String(campaign._id),
        customerId: getEntityId(recipient.customer),
        serviceId: getEntityId(recipient.service),
        type: "rebooking_campaign",
      },
    });

    return {
      status: result?.status === "delivered" ? "delivered" : "sent",
      providerMessageId: String(
        result?.messageId || result?.id || result?.providerMessageId || ""
      ),
      deliveredAt: result?.status === "delivered" ? new Date() : null,
    };
  } catch (error) {
    return {
      status: "failed",
      errorMessage: error?.message || "Message delivery failed.",
    };
  }
}

async function sendRebookingCampaign(campaignId) {
  const campaign = await RebookingCampaign.findById(campaignId);

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  if (campaign.status === "cancelled") {
    const error = new Error("A cancelled campaign cannot be sent.");
    error.statusCode = 409;
    throw error;
  }

  const adapter = await loadDeliveryAdapter();
  let queuedCount = 0;
  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  for (const recipient of campaign.recipients) {
    if (["sent", "delivered", "cancelled"].includes(recipient.status)) {
      continue;
    }

    const result = await dispatchRecipient({ campaign, recipient, adapter });
    recipient.status = result.status;
    recipient.providerMessageId = result.providerMessageId || "";
    recipient.errorMessage = result.errorMessage || "";
    recipient.sentAt = ["sent", "delivered"].includes(result.status)
      ? new Date()
      : null;
    recipient.deliveredAt = result.deliveredAt || null;

    if (result.status === "queued") queuedCount += 1;
    if (result.status === "sent") sentCount += 1;
    if (result.status === "delivered") deliveredCount += 1;
    if (result.status === "failed") failedCount += 1;
  }

  if (sentCount + deliveredCount > 0) {
    campaign.status = "sent";
    campaign.sentAt = new Date();
  } else if (queuedCount > 0) {
    campaign.status = "queued";
    campaign.sentAt = null;
  } else {
    campaign.status = "failed";
    campaign.sentAt = null;
  }
  await campaign.save();

  return {
    campaign: campaign.toObject(),
    dispatch: {
      queuedCount,
      sentCount,
      deliveredCount,
      failedCount,
      adapterAvailable: Boolean(adapter),
    },
  };
}

async function cancelRebookingCampaign(campaignId) {
  const campaign = await RebookingCampaign.findById(campaignId);

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  if (campaign.status === "sent") {
    const error = new Error("A sent campaign cannot be cancelled.");
    error.statusCode = 409;
    throw error;
  }

  campaign.status = "cancelled";
  campaign.cancelledAt = new Date();
  campaign.recipients.forEach((recipient) => {
    if (!["sent", "delivered"].includes(recipient.status)) {
      recipient.status = "cancelled";
    }
  });

  await campaign.save();
  return campaign.toObject();
}

async function calculateCampaignResults(campaignId) {
  const campaign = await RebookingCampaign.findById(campaignId);

  if (!campaign) {
    const error = new Error("Rebooking campaign not found.");
    error.statusCode = 404;
    throw error;
  }

  const campaignStart = campaign.sentAt || campaign.createdAt;
  const customerIds = campaign.recipients
    .map((recipient) => getEntityId(recipient.customer))
    .filter(Boolean);

  if (customerIds.length > 0) {
    const appointments = await Appointment.find({
      customer: { $in: customerIds },
      status: { $in: Array.from(ACTIVE_BOOKING_STATUSES).concat("completed") },
      $or: [
        { startsAt: { $gte: campaignStart } },
        { appointmentDate: { $gte: campaignStart } },
      ],
    })
      .populate("service", "name price")
      .lean();

    for (const recipient of campaign.recipients) {
      const customerId = getEntityId(recipient.customer);
      const serviceId = getEntityId(recipient.service);

      const matchingAppointment = appointments.find((appointment) => {
        const appointmentCustomerId = getEntityId(appointment.customer);
        const appointmentServiceId = getEntityId(appointment.service);

        return (
          appointmentCustomerId === customerId &&
          (!serviceId || appointmentServiceId === serviceId) &&
          getAppointmentDate(appointment)
        );
      });

      if (matchingAppointment) {
        recipient.rebookedAppointment = matchingAppointment._id;
        recipient.recoveredRevenue = roundMoney(
          getAppointmentValue(matchingAppointment)
        );
      }
    }

    await campaign.save();
  }

  const recipientCount = campaign.recipients.length;
  const rebookedRecipients = campaign.recipients.filter(
    (recipient) => recipient.rebookedAppointment
  );
  const recoveredRevenue = rebookedRecipients.reduce(
    (total, recipient) => total + Number(recipient.recoveredRevenue || 0),
    0
  );

  return {
    campaignId: String(campaign._id),
    recipientCount,
    sentCount: campaign.recipients.filter((recipient) =>
      ["sent", "delivered"].includes(recipient.status)
    ).length,
    queuedCount: campaign.recipients.filter(
      (recipient) => recipient.status === "queued"
    ).length,
    failedCount: campaign.recipients.filter(
      (recipient) => recipient.status === "failed"
    ).length,
    rebookedCount: rebookedRecipients.length,
    conversionRate:
      recipientCount > 0
        ? Math.round((rebookedRecipients.length / recipientCount) * 1000) / 10
        : 0,
    recoveredRevenue: roundMoney(recoveredRevenue),
  };
}

export {
  calculateCampaignResults,
  cancelRebookingCampaign,
  createRebookingCampaign,
  getRebookingCampaign,
  listRebookingCampaigns,
  scheduleRebookingCampaign,
  sendRebookingCampaign,
  updateRebookingCampaign,
};
