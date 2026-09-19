import twilio from "twilio";

function whatsappAddress(value) {
  const text = String(value || "").trim();

  return text.startsWith("whatsapp:")
    ? text
    : `whatsapp:${text}`;
}

function normaliseContentVariables(value) {
  if (!value) {
    return undefined;
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    const error = new Error(
      "WhatsApp template variables must be an object."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_TEMPLATE_VARIABLES_INVALID";
    throw error;
  }

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) => [
          String(key),
          String(item ?? ""),
        ]
      )
    )
  );
}

function assertConfiguration() {
  const missing = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
  ].filter(
    (key) =>
      !String(process.env[key] || "").trim()
  );

  if (missing.length > 0) {
    const error = new Error(
      `Missing Twilio WhatsApp configuration: ${missing.join(", ")}`
    );
    error.statusCode = 500;
    error.code =
      "WHATSAPP_TWILIO_CONFIGURATION_MISSING";
    throw error;
  }
}

export async function sendTwilioWhatsApp({
  to,
  message = "",
  contentSid = "",
  contentVariables = null,
  statusCallbackUrl = "",
} = {}) {
  assertConfiguration();

  const body = String(message || "").trim();
  const templateSid = String(
    contentSid || ""
  ).trim();

  if (!templateSid && !body) {
    const error = new Error(
      "A WhatsApp message body or Twilio Content SID is required."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_MESSAGE_CONTENT_REQUIRED";
    throw error;
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const payload = {
    from: whatsappAddress(
      process.env.TWILIO_WHATSAPP_FROM
    ),
    to: whatsappAddress(to),
  };

  const callback = String(
    statusCallbackUrl ||
      process.env
        .TWILIO_WHATSAPP_STATUS_CALLBACK_URL ||
      ""
  ).trim();

  if (callback) {
    payload.statusCallback = callback;
  }

  if (templateSid) {
    payload.contentSid = templateSid;

    const variables =
      normaliseContentVariables(
        contentVariables
      );

    if (variables) {
      payload.contentVariables =
        variables;
    }
  } else {
    payload.body = body;
  }

  const result =
    await client.messages.create(payload);

  return {
    provider: "twilio",
    status: result.status || "sent",
    messageId: result.sid,
    template: Boolean(templateSid),
  };
}

export default {
  send: sendTwilioWhatsApp,
};