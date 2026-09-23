import Customer from "../models/customer.js";
import ConsentRecord from "../models/ConsentRecord.js";
import {
  getPublicLegalIdentity,
} from "../config/legalComplianceConfig.js";
import {
  tokenMatchesCustomer,
  verifyMarketingPreferenceToken,
} from "../services/marketingPreferenceTokenService.js";

const CHANNELS = new Set([
  "email",
  "sms",
  "whatsapp",
  "all",
]);

function preferenceState(customer) {
  const preferences =
    customer.communicationPreferences || {};
  const marketing =
    customer.marketing || {};

  return {
    email:
      preferences.emailMarketing === true &&
      marketing.emailConsent === true &&
      preferences.emailUnsubscribed !== true &&
      preferences.unsubscribed !== true,
    sms:
      preferences.smsMarketing === true &&
      marketing.smsConsent === true &&
      preferences.smsUnsubscribed !== true &&
      preferences.unsubscribed !== true,
    whatsapp:
      preferences.whatsappMarketing === true &&
      marketing.whatsappConsent === true &&
      preferences.whatsappUnsubscribed !== true &&
      preferences.unsubscribed !== true,
  };
}

async function resolveCustomer(token) {
  const payload =
    verifyMarketingPreferenceToken(token);
  const customer =
    await Customer.findById(payload.c);

  if (
    !customer ||
    !tokenMatchesCustomer(
      payload,
      customer
    )
  ) {
    const error =
      new Error(
        "The marketing preference link is invalid or no longer matches this customer."
      );
    error.statusCode = 404;
    error.code =
      "MARKETING_PREFERENCE_LINK_NOT_FOUND";
    throw error;
  }

  return customer;
}

async function recordWithdrawal(
  customer,
  channel,
  recordedAt
) {
  const purpose =
    channel === "sms"
      ? "sms_marketing"
      : channel === "whatsapp"
        ? "whatsapp_marketing"
        : "email_marketing";

  await ConsentRecord.create({
    customer:
      customer.userAccount ||
      null,
    customerProfile:
      customer._id,
    purpose,
    channel,
    granted: false,
    source:
      "public_unsubscribe",
    policyVersion:
      process.env.PRIVACY_POLICY_VERSION ||
      "marketing-v1",
    recordedAt,
  });
}

function withdrawChannel(
  customer,
  channel,
  recordedAt
) {
  const preferences =
    customer.communicationPreferences ||
    {};
  const marketing =
    customer.marketing ||
    {};

  if (channel === "email") {
    preferences.emailMarketing = false;
    marketing.emailConsent = false;
    marketing.emailConsentUpdatedAt =
      recordedAt;
  }

  if (channel === "sms") {
    preferences.smsMarketing = false;
    marketing.smsConsent = false;
    marketing.smsConsentUpdatedAt =
      recordedAt;
  }

  if (channel === "whatsapp") {
    preferences.whatsappMarketing =
      false;
    marketing.whatsappConsent =
      false;
    marketing.whatsappConsentUpdatedAt =
      recordedAt;
  }

  preferences.promotionalMessages = [
    preferences.emailMarketing,
    preferences.smsMarketing,
    preferences.whatsappMarketing,
  ].some((value) => value === true);

  preferences.consentUpdatedAt =
    recordedAt;
  preferences.consentSource =
    "public_unsubscribe";
  marketing.consentSource =
    "public_unsubscribe";

  customer.communicationPreferences =
    preferences;
  customer.marketing =
    marketing;
}

export async function getPublicMarketingPreferences(
  req,
  res
) {
  const customer =
    await resolveCustomer(
      req.params.token
    );

  return res.json({
    success: true,
    marketingPreferences:
      preferenceState(customer),
    legal:
      getPublicLegalIdentity(),
    reconsentRequiresAuthentication:
      true,
  });
}

export async function unsubscribePublicMarketing(
  req,
  res
) {
  const requestedChannel =
    String(
      req.params.channel ||
      req.body?.channel ||
      "all"
    )
      .trim()
      .toLowerCase();

  if (!CHANNELS.has(requestedChannel)) {
    const error =
      new Error(
        "Channel must be email, sms, whatsapp or all."
      );
    error.statusCode = 422;
    error.code =
      "MARKETING_PREFERENCE_CHANNEL_INVALID";
    throw error;
  }

  const customer =
    await resolveCustomer(
      req.params.token
    );

  const channels =
    requestedChannel === "all"
      ? ["email", "sms", "whatsapp"]
      : [requestedChannel];

  const before =
    preferenceState(customer);
  const recordedAt =
    new Date();

  for (const channel of channels) {
    withdrawChannel(
      customer,
      channel,
      recordedAt
    );
  }

  await customer.save();

  for (const channel of channels) {
    if (before[channel] === true) {
      await recordWithdrawal(
        customer,
        channel,
        recordedAt
      );
    }
  }

  return res.json({
    success: true,
    message:
      requestedChannel === "all"
        ? "Marketing communications have been turned off for all channels."
        : `${requestedChannel.toUpperCase()} marketing has been turned off.`,
    marketingPreferences:
      preferenceState(customer),
    reconsentRequiresAuthentication:
      true,
  });
}

export default {
  getPublicMarketingPreferences,
  unsubscribePublicMarketing,
};
