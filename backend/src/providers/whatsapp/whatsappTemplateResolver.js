import {
  getWhatsAppProviderName,
} from "./whatsappProviderFactory.js";

const TWILIO_CONTENT_SID_PATTERN =
  /^HX[A-Za-z0-9]{32}$/;

const META_TEMPLATE_NAME_PATTERN =
  /^[a-z0-9_]{1,512}$/;

function text(value) {
  return String(value ?? "").trim();
}

function createTemplateError(
  message,
  code,
  field
) {
  const error = new Error(message);

  error.statusCode = 400;
  error.status = 400;
  error.code = code;
  error.details = {
    field,
  };

  return error;
}

function normaliseTwilioTemplate({
  contentSid = "",
} = {}) {
  const sid = text(contentSid);

  if (!sid) {
    return {
      provider: "twilio",
      supplied: false,
      contentSid: "",
      templateName: "",
      templateLanguage: "",
    };
  }

  if (
    !TWILIO_CONTENT_SID_PATTERN.test(
      sid
    )
  ) {
    throw createTemplateError(
      "The Twilio WhatsApp Content SID is invalid.",
      "WHATSAPP_CONTENT_SID_INVALID",
      "contentSid"
    );
  }

  return {
    provider: "twilio",
    supplied: true,
    contentSid: sid,
    templateName: "",
    templateLanguage: "",
  };
}

function normaliseMetaTemplate({
  templateName = "",
  templateLanguage = "",
} = {}) {
  const name = text(
    templateName
  ).toLowerCase();

  const language =
    text(templateLanguage) ||
    text(
      process.env
        .META_WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE
    ) ||
    "en_GB";

  if (!name) {
    return {
      provider: "meta",
      supplied: false,
      contentSid: "",
      templateName: "",
      templateLanguage:
        language,
    };
  }

  if (
    !META_TEMPLATE_NAME_PATTERN.test(
      name
    )
  ) {
    throw createTemplateError(
      "The Meta WhatsApp template name is invalid.",
      "WHATSAPP_META_TEMPLATE_NAME_INVALID",
      "templateName"
    );
  }

  return {
    provider: "meta",
    supplied: true,
    contentSid: "",
    templateName: name,
    templateLanguage:
      language,
  };
}

function normaliseConsoleTemplate({
  contentSid = "",
  templateName = "",
  templateLanguage = "",
} = {}) {
  const sid =
    text(contentSid);

  const name =
    text(templateName);

  return {
    provider: "console",

    supplied:
      Boolean(sid || name),

    contentSid: sid,

    templateName:
      name,

    templateLanguage:
      text(templateLanguage) ||
      "en_GB",
  };
}

export function normaliseWhatsAppTemplate(
  input = {}
) {
  const provider =
    getWhatsAppProviderName();

  if (provider === "twilio") {
    return normaliseTwilioTemplate(
      input
    );
  }

  if (provider === "meta") {
    return normaliseMetaTemplate(
      input
    );
  }

  return normaliseConsoleTemplate(
    input
  );
}

export function resolveWhatsAppEventTemplate(
  eventKey
) {
  const key = text(eventKey)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) {
    return normaliseWhatsAppTemplate();
  }

  const provider =
    getWhatsAppProviderName();

  if (provider === "twilio") {
    return normaliseWhatsAppTemplate({
      contentSid:
        process.env[
          `TWILIO_WHATSAPP_${key}_CONTENT_SID`
        ] || "",
    });
  }

  if (provider === "meta") {
    return normaliseWhatsAppTemplate({
      templateName:
        process.env[
          `META_WHATSAPP_${key}_TEMPLATE_NAME`
        ] || "",

      templateLanguage:
        process.env[
          `META_WHATSAPP_${key}_TEMPLATE_LANGUAGE`
        ] ||
        process.env
          .META_WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE ||
        "en_GB",
    });
  }

  return normaliseWhatsAppTemplate({
    contentSid:
      process.env[
        `TWILIO_WHATSAPP_${key}_CONTENT_SID`
      ] || "",

    templateName:
      process.env[
        `META_WHATSAPP_${key}_TEMPLATE_NAME`
      ] || "",
  });
}

export {
  META_TEMPLATE_NAME_PATTERN,
  TWILIO_CONTENT_SID_PATTERN,
};

export default {
  normaliseWhatsAppTemplate,
  resolveWhatsAppEventTemplate,
};