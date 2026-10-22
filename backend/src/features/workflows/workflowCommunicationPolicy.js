import {
  createServiceError,
} from "../../shared/serviceError.js";

const CHANNELS = Object.freeze({
  email: {
    recipient: "email",
    unsubscribed: "emailUnsubscribed",
    marketingPreference: "emailMarketing",
    marketingConsent: "emailConsent",
  },
  sms: {
    recipient: "phone",
    unsubscribed: "smsUnsubscribed",
    marketingPreference: "smsMarketing",
    marketingConsent: "smsConsent",
  },
  whatsapp: {
    recipient: "phone",
    unsubscribed: "whatsappUnsubscribed",
    marketingPreference: "whatsappMarketing",
    marketingConsent: "whatsappConsent",
  },
  phone: {
    recipient: "phone",
    unsubscribed: "smsUnsubscribed",
  },
  in_app: {
    recipient: "_id",
  },
});

function policyError(message, details = {}) {
  const error = createServiceError(message, 409, details);
  error.code = "WORKFLOW_COMMUNICATION_POLICY_BLOCKED";
  return error;
}

export function assertWorkflowCommunicationAllowed(
  customer,
  {
    channel,
    classification = "transactional",
    allowedChannels = [],
  } = {}
) {
  const selectedChannel = String(channel || "").trim().toLowerCase();
  const selectedClassification = String(classification || "transactional")
    .trim()
    .toLowerCase();
  const rule = CHANNELS[selectedChannel];

  if (!rule) {
    throw policyError("Workflow communication channel is unsupported.", {
      channel: selectedChannel,
    });
  }

  if (
    Array.isArray(allowedChannels) &&
    allowedChannels.length > 0 &&
    !allowedChannels.includes(selectedChannel)
  ) {
    throw policyError("Workflow policy does not allow this communication channel.", {
      channel: selectedChannel,
    });
  }

  const preferences = customer?.communicationPreferences || {};
  const marketing = customer?.marketing || {};

  if (preferences.unsubscribed === true) {
    throw policyError("Customer is unsubscribed from communications.", {
      channel: selectedChannel,
    });
  }
  if (rule.unsubscribed && preferences[rule.unsubscribed] === true) {
    throw policyError("Customer is unsubscribed from this communication channel.", {
      channel: selectedChannel,
    });
  }

  if (selectedClassification === "marketing") {
    if (!rule.marketingPreference || !rule.marketingConsent) {
      throw policyError("Marketing is not supported on this workflow channel.", {
        channel: selectedChannel,
      });
    }
    if (
      preferences[rule.marketingPreference] !== true ||
      marketing[rule.marketingConsent] !== true
    ) {
      throw policyError("Marketing consent is not recorded for this channel.", {
        channel: selectedChannel,
      });
    }
    if (selectedChannel === "email" && marketing.emailSuppressed === true) {
      throw policyError("Customer email is suppressed for marketing.", {
        channel: selectedChannel,
      });
    }
  } else if (selectedClassification !== "transactional") {
    throw policyError("Communication classification must be transactional or marketing.", {
      classification: selectedClassification,
    });
  }

  const recipient =
    rule.recipient === "_id"
      ? String(customer?._id || "")
      : String(customer?.[rule.recipient] || "").trim();
  if (!recipient) {
    throw policyError("Customer does not have a recipient for this channel.", {
      channel: selectedChannel,
    });
  }

  return Object.freeze({
    allowed: true,
    channel: selectedChannel,
    classification: selectedClassification,
    recipient,
  });
}

export default Object.freeze({
  assertWorkflowCommunicationAllowed,
});
