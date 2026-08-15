import Customer from "../../models/customer.js";

const ALLOWED_CHANNELS = new Set([
  "email",
  "sms",
  "whatsapp",
  "none",
]);

function text(value) {
  return String(value ?? "").trim();
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function customerFor(user) {
  if (!user?._id) {
    throw httpError("Authentication is required.", 401);
  }

  if (user.customerProfile) {
    const linked = await Customer.findById(user.customerProfile);
    if (linked) return linked;
  }

  const customer = await Customer.findOne({
    $or: [
      { userAccount: user._id },
      ...(user.email ? [{ email: String(user.email).trim().toLowerCase() }] : []),
    ],
  });

  if (!customer) {
    throw httpError(
      "No salon customer profile is linked to this account.",
      404
    );
  }

  return customer;
}

function publicPreferences(customer) {
  const preferences = customer.communicationPreferences || {};

  return {
    preferredChannel: preferences.preferredChannel || "email",
    appointmentReminders: preferences.appointmentReminders !== false,
    promotionalMessages: preferences.promotionalMessages !== false,
    serviceUpdates: preferences.serviceUpdates !== false,
    birthdayMessages: preferences.birthdayMessages !== false,
    feedbackRequests: preferences.feedbackRequests !== false,
    emailUnsubscribed: preferences.emailUnsubscribed === true,
    smsUnsubscribed: preferences.smsUnsubscribed === true,
    unsubscribed: preferences.unsubscribed === true,
    consentUpdatedAt: preferences.consentUpdatedAt || null,
  };
}

export async function getCommunicationPreferences(req, res) {
  const customer = await customerFor(req.user);

  return res.json({
    success: true,
    communicationPreferences: publicPreferences(customer),
  });
}

export async function updateCommunicationPreferences(req, res) {
  const customer = await customerFor(req.user);
  const current = publicPreferences(customer);
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const preferredChannel = text(
    body.preferredChannel ?? current.preferredChannel
  ).toLowerCase();

  if (!ALLOWED_CHANNELS.has(preferredChannel)) {
    throw httpError(
      "Preferred channel must be email, sms, whatsapp or none.",
      422
    );
  }

  customer.communicationPreferences = {
    ...current,
    preferredChannel,
    appointmentReminders:
      body.appointmentReminders === undefined
        ? current.appointmentReminders
        : Boolean(body.appointmentReminders),
    promotionalMessages:
      body.promotionalMessages === undefined
        ? current.promotionalMessages
        : Boolean(body.promotionalMessages),
    serviceUpdates:
      body.serviceUpdates === undefined
        ? current.serviceUpdates
        : Boolean(body.serviceUpdates),
    birthdayMessages:
      body.birthdayMessages === undefined
        ? current.birthdayMessages
        : Boolean(body.birthdayMessages),
    feedbackRequests:
      body.feedbackRequests === undefined
        ? current.feedbackRequests
        : Boolean(body.feedbackRequests),
    emailUnsubscribed:
      body.emailUnsubscribed === undefined
        ? current.emailUnsubscribed
        : Boolean(body.emailUnsubscribed),
    smsUnsubscribed:
      body.smsUnsubscribed === undefined
        ? current.smsUnsubscribed
        : Boolean(body.smsUnsubscribed),
    unsubscribed:
      body.unsubscribed === undefined
        ? current.unsubscribed
        : Boolean(body.unsubscribed),
    consentUpdatedAt: new Date(),
  };

  customer.updatedBy = req.user._id;
  await customer.save();

  return res.json({
    success: true,
    communicationPreferences: publicPreferences(customer),
  });
}

export default {
  getCommunicationPreferences,
  updateCommunicationPreferences,
};
