function text(value) {
  return String(value ?? "").trim();
}

function metaPhone(value) {
  return text(value)
    .replace(/^whatsapp:/i, "")
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "");
}

function configuration() {
  return {
    accessToken:
      text(
        process.env
          .META_WHATSAPP_ACCESS_TOKEN
      ),

    phoneNumberId:
      text(
        process.env
          .META_WHATSAPP_PHONE_NUMBER_ID
      ),

    graphVersion:
      text(
        process.env
          .META_WHATSAPP_GRAPH_VERSION
      ),
  };
}

function assertConfiguration(config) {
  const missing = [];

  if (!config.accessToken) {
    missing.push(
      "META_WHATSAPP_ACCESS_TOKEN"
    );
  }

  if (!config.phoneNumberId) {
    missing.push(
      "META_WHATSAPP_PHONE_NUMBER_ID"
    );
  }

  if (!config.graphVersion) {
    missing.push(
      "META_WHATSAPP_GRAPH_VERSION"
    );
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing Meta WhatsApp configuration: ${missing.join(", ")}`
    );
    error.statusCode = 500;
    error.code =
      "WHATSAPP_META_CONFIGURATION_MISSING";
    throw error;
  }
}

function normaliseTemplateComponents(
  contentVariables,
  templateComponents
) {
  if (Array.isArray(templateComponents)) {
    return templateComponents;
  }

  if (!contentVariables) {
    return undefined;
  }

  if (
    typeof contentVariables !== "object" ||
    Array.isArray(contentVariables)
  ) {
    const error = new Error(
      "Meta WhatsApp template variables must be an object."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_TEMPLATE_VARIABLES_INVALID";
    throw error;
  }

  const entries =
    Object.entries(contentVariables);

  if (entries.length === 0) {
    return undefined;
  }

  entries.sort(([left], [right]) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (
      Number.isFinite(leftNumber) &&
      Number.isFinite(rightNumber)
    ) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right);
  });

  return [
    {
      type: "body",
      parameters: entries.map(
        ([, value]) => ({
          type: "text",
          text: String(value ?? ""),
        })
      ),
    },
  ];
}

async function readResponse(response) {
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      raw,
    };
  }
}

export async function sendMetaWhatsApp({
  to,
  message = "",
  contentSid = "",
  contentVariables = null,
  templateName = "",
  templateLanguage = "en_GB",
  templateComponents = null,
} = {}) {
  const config = configuration();
  assertConfiguration(config);

  const phone = metaPhone(to);
  const body = text(message);
  const metaTemplateName =
    text(templateName);

  if (!phone) {
    const error = new Error(
      "A WhatsApp recipient is required."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_RECIPIENT_REQUIRED";
    throw error;
  }

  /*
   * A Twilio Content SID cannot be sent directly
   * through Meta. Require an explicit Meta template
   * mapping rather than silently treating it as a
   * free-form message.
   */
  if (contentSid && !metaTemplateName) {
    const error = new Error(
      "This notification contains a Twilio WhatsApp Content SID but no Meta template mapping."
    );
    error.statusCode = 500;
    error.code =
      "WHATSAPP_META_TEMPLATE_MAPPING_REQUIRED";
    throw error;
  }

  if (!metaTemplateName && !body) {
    const error = new Error(
      "A WhatsApp message body or Meta template name is required."
    );
    error.statusCode = 400;
    error.code =
      "WHATSAPP_MESSAGE_CONTENT_REQUIRED";
    throw error;
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
  };

  if (metaTemplateName) {
    const components =
      normaliseTemplateComponents(
        contentVariables,
        templateComponents
      );

    payload.type = "template";
    payload.template = {
      name: metaTemplateName,
      language: {
        code:
          text(templateLanguage) ||
          "en_GB",
      },
      ...(components
        ? { components }
        : {}),
    };
  } else {
    payload.type = "text";
    payload.text = {
      preview_url: false,
      body,
    };
  }

  const endpoint =
    `https://graph.facebook.com/` +
    `${encodeURIComponent(
      config.graphVersion
    )}/` +
    `${encodeURIComponent(
      config.phoneNumberId
    )}/messages`;

  const response = await fetch(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${config.accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result =
    await readResponse(response);

  if (!response.ok) {
    const error = new Error(
      result?.error?.message ||
        `Meta WhatsApp request failed with HTTP ${response.status}.`
    );

    error.statusCode =
      response.status >= 500
        ? 502
        : 400;

    error.code =
      "WHATSAPP_META_DELIVERY_FAILED";

    error.providerResponse = result;
    error.retryable =
      response.status >= 500 ||
      response.status === 429;

    throw error;
  }

  return {
    provider: "meta",
    status: "accepted",
    messageId:
      result?.messages?.[0]?.id || "",
    template:
      Boolean(metaTemplateName),
  };
}

export default {
  send: sendMetaWhatsApp,
};