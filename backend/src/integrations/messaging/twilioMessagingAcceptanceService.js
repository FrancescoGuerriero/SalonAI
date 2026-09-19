import {
  getTwilioMessagingStatusCallbackReadiness,
} from "../../config/messageDeliveryConfig.js";

const CONFIRMATION =
  "RUN_TWILIO_MESSAGING_ACCEPTANCE";

const SUPPORTED_CHANNELS =
  new Set([
    "sms",
    "whatsapp",
  ]);

const SUCCESS_STATUSES =
  new Set([
    "accepted",
    "queued",
    "scheduled",
    "sending",
    "sent",
    "delivered",
    "read",
  ]);

const DELIVERED_STATUSES =
  new Set([
    "delivered",
    "read",
  ]);

const FAILURE_STATUSES =
  new Set([
    "failed",
    "undelivered",
    "canceled",
    "cancelled",
  ]);

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function boolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return [
    "1",
    "true",
    "yes",
    "on",
    "enabled",
  ].includes(
    text(value)
      .toLowerCase()
  );
}

function integer(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      parsed
    )
  );
}

function normalisePhone(
  value,
  field
) {
  let phone =
    text(value)
      .replace(
        /^whatsapp:/i,
        ""
      )
      .replace(
        /[\s().-]/g,
        ""
      );

  if (
    phone.startsWith(
      "00"
    )
  ) {
    phone =
      `+${phone.slice(2)}`;
  }

  if (
    phone &&
    !phone.startsWith("+")
  ) {
    phone =
      `+${phone}`;
  }

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      phone
    )
  ) {
    const error =
      new Error(
        `${field} must be a valid E.164 phone number.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_PHONE_INVALID";
    throw error;
  }

  return phone;
}

function parseChannels(
  value
) {
  const channels =
    Array.from(
      new Set(
        text(value || "sms,whatsapp")
          .toLowerCase()
          .split(",")
          .map(
            (item) =>
              item.trim()
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    channels.length ===
      0 ||
    channels.some(
      (channel) =>
        !SUPPORTED_CHANNELS.has(
          channel
        )
    )
  ) {
    const error =
      new Error(
        "TWILIO_ACCEPTANCE_CHANNELS must contain sms, whatsapp, or both."
      );
    error.code =
      "TWILIO_ACCEPTANCE_CHANNEL_INVALID";
    throw error;
  }

  return channels;
}

function parseVariables(
  value
) {
  const source =
    text(value);

  if (!source) {
    return null;
  }

  let parsed;

  try {
    parsed =
      JSON.parse(
        source
      );
  } catch {
    const error =
      new Error(
        "TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_VARIABLES must be valid JSON."
      );
    error.code =
      "TWILIO_ACCEPTANCE_CONTENT_VARIABLES_INVALID";
    throw error;
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed
    )
  ) {
    const error =
      new Error(
        "TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_VARIABLES must be a JSON object."
      );
    error.code =
      "TWILIO_ACCEPTANCE_CONTENT_VARIABLES_INVALID";
    throw error;
  }

  return parsed;
}

export function buildTwilioMessagingAcceptancePlan(
  environment =
    process.env
) {
  if (
    text(
      environment
        .TWILIO_ACCEPTANCE_CONFIRM
    ) !==
    CONFIRMATION
  ) {
    const error =
      new Error(
        `Refusing to send real messages. Set TWILIO_ACCEPTANCE_CONFIRM=${CONFIRMATION} only for a deliberate acceptance run.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_CONFIRMATION_REQUIRED";
    throw error;
  }

  const accountSid =
    text(
      environment
        .TWILIO_ACCOUNT_SID
    );
  const authToken =
    text(
      environment
        .TWILIO_AUTH_TOKEN
    );

  if (
    !accountSid ||
    !authToken
  ) {
    const error =
      new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required."
      );
    error.code =
      "TWILIO_ACCEPTANCE_CREDENTIALS_REQUIRED";
    throw error;
  }

  const callbackReadiness =
    getTwilioMessagingStatusCallbackReadiness(
      environment
    );

  if (
    !callbackReadiness.ready
  ) {
    const error =
      new Error(
        `Twilio acceptance requires one unambiguous HTTPS messaging status callback. Blocking checks: ${callbackReadiness.blockers.join(", ")}.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_STATUS_CALLBACK_NOT_READY";
    throw error;
  }

  const channels =
    parseChannels(
      environment
        .TWILIO_ACCEPTANCE_CHANNELS
    );
  const requireDelivery =
    boolean(
      environment
        .TWILIO_ACCEPTANCE_REQUIRE_DELIVERY,
      false
    );
  const timeoutMs =
    integer(
      environment
        .TWILIO_ACCEPTANCE_STATUS_TIMEOUT_MS,
      60_000,
      5_000,
      180_000
    );
  const pollIntervalMs =
    integer(
      environment
        .TWILIO_ACCEPTANCE_STATUS_POLL_MS,
      1_000,
      250,
      10_000
    );
  const message =
    text(
      environment
        .TWILIO_ACCEPTANCE_MESSAGE
    ) ||
    "SalonAI Twilio acceptance test. No reply is required.";

  const plan = {
    channels,
    requireDelivery,
    timeoutMs,
    pollIntervalMs,
    message:
      message.slice(
        0,
        500
      ),
    sms: null,
    whatsapp: null,
  };

  if (
    channels.includes(
      "sms"
    )
  ) {
    const smsTo =
      normalisePhone(
        environment
          .TWILIO_ACCEPTANCE_SMS_TO,
        "TWILIO_ACCEPTANCE_SMS_TO"
      );

    const smsFrom =
      text(
        environment
          .TWILIO_FROM_NUMBER ||
        environment
          .TWILIO_SMS_FROM
      );
    const messagingServiceSid =
      text(
        environment
          .TWILIO_MESSAGING_SERVICE_SID
      );

    if (
      !smsFrom &&
      !messagingServiceSid
    ) {
      const error =
        new Error(
          "SMS acceptance requires TWILIO_FROM_NUMBER/TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID."
        );
      error.code =
        "TWILIO_ACCEPTANCE_SMS_SENDER_REQUIRED";
      throw error;
    }

    plan.sms = {
      to:
        smsTo,
    };
  }

  if (
    channels.includes(
      "whatsapp"
    )
  ) {
    const whatsappTo =
      normalisePhone(
        environment
          .TWILIO_ACCEPTANCE_WHATSAPP_TO,
        "TWILIO_ACCEPTANCE_WHATSAPP_TO"
      );
    const whatsappFrom =
      text(
        environment
          .TWILIO_WHATSAPP_FROM
      );

    if (!whatsappFrom) {
      const error =
        new Error(
          "WhatsApp acceptance requires TWILIO_WHATSAPP_FROM."
        );
      error.code =
        "TWILIO_ACCEPTANCE_WHATSAPP_SENDER_REQUIRED";
      throw error;
    }

    plan.whatsapp = {
      to:
        whatsappTo,
      contentSid:
        text(
          environment
            .TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_SID
        ),
      contentVariables:
        parseVariables(
          environment
            .TWILIO_ACCEPTANCE_WHATSAPP_CONTENT_VARIABLES
        ),
    };
  }

  return plan;
}

function statusValue(
  result
) {
  return text(
    result?.status
  ).toLowerCase();
}

async function waitForDelivery({
  channel,
  messageId,
  lookupStatus,
  timeoutMs,
  pollIntervalMs,
  sleep,
}) {
  const started =
    Date.now();

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    const status =
      await lookupStatus(
        channel,
        messageId
      );
    const value =
      statusValue(
        status
      );

    if (
      DELIVERED_STATUSES.has(
        value
      )
    ) {
      return status;
    }

    if (
      FAILURE_STATUSES.has(
        value
      )
    ) {
      const error =
        new Error(
          `Twilio ${channel} acceptance message reached failure status ${value}.`
        );
      error.code =
        "TWILIO_ACCEPTANCE_DELIVERY_FAILED";
      error.status =
        status;
      throw error;
    }

    await sleep(
      pollIntervalMs
    );
  }

  const error =
    new Error(
      `Twilio ${channel} acceptance message was not delivered within ${timeoutMs}ms.`
    );
  error.code =
    "TWILIO_ACCEPTANCE_DELIVERY_TIMEOUT";
  throw error;
}

function assertSendResult(
  channel,
  result
) {
  const messageId =
    text(
      result?.messageId ||
      result?.providerMessageId
    );
  const status =
    statusValue(
      result
    );

  if (!messageId) {
    const error =
      new Error(
        `Twilio ${channel} acceptance did not return a provider message id.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_MESSAGE_ID_MISSING";
    throw error;
  }

  if (
    FAILURE_STATUSES.has(
      status
    )
  ) {
    const error =
      new Error(
        `Twilio ${channel} acceptance failed with status ${status}.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_SEND_FAILED";
    throw error;
  }

  if (
    status &&
    !SUCCESS_STATUSES.has(
      status
    )
  ) {
    const error =
      new Error(
        `Twilio ${channel} acceptance returned unexpected status ${status}.`
      );
    error.code =
      "TWILIO_ACCEPTANCE_STATUS_UNEXPECTED";
    throw error;
  }

  return {
    messageId,
    status:
      status ||
      "accepted",
  };
}

export async function runTwilioMessagingAcceptance({
  plan,
  sendSms,
  sendWhatsApp,
  lookupStatus,
  sleep = (
    milliseconds
  ) =>
    new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds
        )
    ),
} = {}) {
  if (!plan) {
    throw new Error(
      "A Twilio acceptance plan is required."
    );
  }

  const results = {};

  if (
    plan.channels.includes(
      "sms"
    )
  ) {
    const sent =
      await sendSms({
        to:
          plan.sms.to,
        body:
          plan.message,
      });
    const base =
      assertSendResult(
        "sms",
        sent
      );
    const delivered =
      plan.requireDelivery
        ? await waitForDelivery({
            channel:
              "sms",
            messageId:
              base.messageId,
            lookupStatus,
            timeoutMs:
              plan.timeoutMs,
            pollIntervalMs:
              plan.pollIntervalMs,
            sleep,
          })
        : null;

    results.sms = {
      success: true,
      provider:
        "twilio",
      ...base,
      deliveryStatus:
        delivered
          ? statusValue(
              delivered
            )
          : null,
    };
  }

  if (
    plan.channels.includes(
      "whatsapp"
    )
  ) {
    const sent =
      await sendWhatsApp({
        to:
          plan.whatsapp.to,
        message:
          plan.whatsapp
            .contentSid
            ? ""
            : plan.message,
        contentSid:
          plan.whatsapp
            .contentSid,
        contentVariables:
          plan.whatsapp
            .contentVariables,
      });
    const base =
      assertSendResult(
        "whatsapp",
        sent
      );
    const delivered =
      plan.requireDelivery
        ? await waitForDelivery({
            channel:
              "whatsapp",
            messageId:
              base.messageId,
            lookupStatus,
            timeoutMs:
              plan.timeoutMs,
            pollIntervalMs:
              plan.pollIntervalMs,
            sleep,
          })
        : null;

    results.whatsapp = {
      success: true,
      provider:
        "twilio",
      ...base,
      template:
        Boolean(
          plan.whatsapp
            .contentSid
        ),
      deliveryStatus:
        delivered
          ? statusValue(
              delivered
            )
          : null,
    };
  }

  return {
    success: true,
    channels:
      results,
    deliveryRequired:
      plan.requireDelivery,
    completedAt:
      new Date()
        .toISOString(),
  };
}

export default {
  buildTwilioMessagingAcceptancePlan,
  runTwilioMessagingAcceptance,
};
