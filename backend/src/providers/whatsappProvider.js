import twilio from "twilio";

function mode() {
  return String(
    process.env.WHATSAPP_PROVIDER_MODE || "console"
  )
    .trim()
    .toLowerCase();
}

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

export async function sendWhatsApp({
  to,
  message = "",
  contentSid = "",
  contentVariables = null,
  statusCallbackUrl = "",
}) {
  const providerMode = mode();
  const templateSid = String(
    contentSid || ""
  ).trim();
  const body = String(
    message || ""
  ).trim();

  if (!templateSid && !body) {
    const error = new Error(
      "A WhatsApp message body or approved template Content SID is required."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_MESSAGE_CONTENT_REQUIRED";
    throw error;
  }

  if (
    [
      "console",
      "mock",
      "sandbox",
    ].includes(providerMode)
  ) {
    console.log("[SalonAI WhatsApp]", {
      to,
      type: templateSid
        ? "template"
        : "freeform",
      contentSid:
        templateSid || undefined,
      message:
        templateSid
          ? undefined
          : body,
    });

    return {
      provider: providerMode,
      status: "sent",
      messageId:
        `${providerMode}_whatsapp_${Date.now()}`,
      template:
        Boolean(templateSid),
    };
  }

  if (
    ![
      "twilio",
      "live",
    ].includes(providerMode)
  ) {
    const error = new Error(
      "WHATSAPP_PROVIDER_MODE must be mock, console, sandbox, twilio or live."
    );
    error.statusCode = 500;
    error.code =
      "WHATSAPP_PROVIDER_MODE_INVALID";
    throw error;
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_WHATSAPP_FROM
  ) {
    const error = new Error(
      "Twilio WhatsApp credentials and sender are required for live delivery."
    );
    error.statusCode = 500;
    error.code =
      "WHATSAPP_TWILIO_CONFIGURATION_MISSING";
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

  const callback =
    String(
      statusCallbackUrl ||
        process.env
          .TWILIO_WHATSAPP_STATUS_CALLBACK_URL ||
        process.env
          .TWILIO_STATUS_CALLBACK_URL ||
        ""
    ).trim();

  if (callback) {
    payload.statusCallback =
      callback;
  }

  if (templateSid) {
    payload.contentSid =
      templateSid;

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
    await client.messages.create(
      payload
    );

  return {
    provider: "twilio",
    status:
      result.status || "sent",
    messageId: result.sid,
    template:
      Boolean(templateSid),
  };
}

export default {
  sendWhatsApp,
};
