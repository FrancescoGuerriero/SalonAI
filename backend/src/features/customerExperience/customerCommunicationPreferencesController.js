import Customer from "../../models/customer.js";
import ConsentRecord from "../../models/ConsentRecord.js";

const ALLOWED_CHANNELS = new Set([
  "email",
  "sms",
  "whatsapp",
  "none",
]);

const MARKETING_CHANNELS = [
  {
    preference: "emailMarketing",
    consent: "emailConsent",
    updatedAt: "emailConsentUpdatedAt",
    purpose: "email_marketing",
    channel: "email",
    unsubscribed: "emailUnsubscribed",
  },
  {
    preference: "smsMarketing",
    consent: "smsConsent",
    updatedAt: "smsConsentUpdatedAt",
    purpose: "sms_marketing",
    channel: "sms",
    unsubscribed: "smsUnsubscribed",
  },
  {
    preference: "whatsappMarketing",
    consent: "whatsappConsent",
    updatedAt: "whatsappConsentUpdatedAt",
    purpose: "whatsapp_marketing",
    channel: "whatsapp",
    unsubscribed: "whatsappUnsubscribed",
  },
];

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

export function marketingConsentFromPreferences(
  preferences = {},
  channel = "email"
) {
  const preferenceName =
    channel === "sms"
      ? "smsMarketing"
      : channel === "whatsapp"
        ? "whatsappMarketing"
        : "emailMarketing";

  const unsubscribeName =
    channel === "sms"
      ? "smsUnsubscribed"
      : channel === "whatsapp"
        ? "whatsappUnsubscribed"
        : "emailUnsubscribed";

  return (
    preferences[preferenceName] === true &&
    preferences[unsubscribeName] !== true &&
    preferences.unsubscribed !== true
  );
}

export function emailMarketingConsentFromPreferences(
  preferences = {}
) {
  return marketingConsentFromPreferences(
    preferences,
    "email"
  );
}

function publicPreferences(customer) {
  const preferences = customer.communicationPreferences || {};

  return {
    preferredChannel: preferences.preferredChannel || "email",
    appointmentReminders: preferences.appointmentReminders !== false,
    promotionalMessages: preferences.promotionalMessages === true,
    emailMarketing: preferences.emailMarketing === true,
    smsMarketing: preferences.smsMarketing === true,
    whatsappMarketing: preferences.whatsappMarketing === true,
    serviceUpdates: preferences.serviceUpdates !== false,
    birthdayMessages: preferences.birthdayMessages === true,
    feedbackRequests: preferences.feedbackRequests === true,
    emailUnsubscribed: preferences.emailUnsubscribed === true,
    smsUnsubscribed: preferences.smsUnsubscribed === true,
    whatsappUnsubscribed: preferences.whatsappUnsubscribed === true,
    unsubscribed: preferences.unsubscribed === true,
    consentUpdatedAt: preferences.consentUpdatedAt || null,
  };
}

async function recordConsent({
  customer,
  user,
  purpose,
  channel,
  granted,
  recordedAt,
}) {
  await ConsentRecord.create({
    customer: user?._id || customer.userAccount || null,
    customerProfile: customer._id,
    purpose,
    channel,
    granted,
    source: "customer_portal",
    policyVersion:
      process.env.PRIVACY_POLICY_VERSION ||
      "marketing-v1",
    recordedAt,
  });
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

  const consentUpdatedAt =
    new Date();

  const channelMarketing = Object.fromEntries(
    MARKETING_CHANNELS.map(({ preference }) => [
      preference,
      body[preference] === undefined
        ? current[preference]
        : body[preference] === true,
    ])
  );

  /*
   * promotionalMessages is retained as a compatibility aggregate only.
   * It is never sufficient on its own to grant channel consent.
   */
  const promotionalMessages =
    Object.values(channelMarketing)
      .some(Boolean);

  customer.communicationPreferences = {
    ...current,
    preferredChannel,
    appointmentReminders:
      body.appointmentReminders === undefined
        ? current.appointmentReminders
        : Boolean(body.appointmentReminders),
    promotionalMessages,
    ...channelMarketing,
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
    whatsappUnsubscribed:
      body.whatsappUnsubscribed === undefined
        ? current.whatsappUnsubscribed
        : Boolean(body.whatsappUnsubscribed),
    unsubscribed:
      body.unsubscribed === undefined
        ? current.unsubscribed
        : Boolean(body.unsubscribed),
    consentUpdatedAt,
    consentSource:
      "customer_portal",
  };

  if (!customer.marketing) {
    customer.marketing = {};
  }

  const consentChanges = [];

  for (const definition of MARKETING_CHANNELS) {
    const granted =
      marketingConsentFromPreferences(
        customer.communicationPreferences,
        definition.channel
      );

    const previous =
      customer.marketing[
        definition.consent
      ] === true;

    customer.marketing[
      definition.consent
    ] = granted;

    customer.marketing[
      definition.updatedAt
    ] = consentUpdatedAt;

    if (previous !== granted) {
      consentChanges.push({
        ...definition,
        granted,
      });
    }
  }

  customer.marketing.consentSource =
    "customer_portal";

  customer.updatedBy = req.user._id;
  await customer.save();

  for (const change of consentChanges) {
    await recordConsent({
      customer,
      user: req.user,
      purpose: change.purpose,
      channel: change.channel,
      granted: change.granted,
      recordedAt: consentUpdatedAt,
    });
  }

  return res.json({
    success: true,
    communicationPreferences: publicPreferences(customer),
  });
}

export default {
  getCommunicationPreferences,
  updateCommunicationPreferences,
};
