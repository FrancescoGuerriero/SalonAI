import crypto from "node:crypto";
import twilio from "twilio";

import {
  getWhatsAppProviderName,
} from "./whatsappProviderFactory.js";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

function text(value) {
  return String(value ?? "").trim();
}

function normalisePhone(value) {
  let phone = text(value)
    .replace(/^whatsapp:/i, "")
    .replace(/[\s()-]/g, "");

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  if (phone && !phone.startsWith("+")) {
    phone = `+${phone}`;
  }

  if (!PHONE_PATTERN.test(phone)) {
    const error = new Error(
      "A valid WhatsApp phone number in international format is required."
    );

    error.statusCode = 400;
    error.code = "WHATSAPP_PHONE_INVALID";
    throw error;
  }

  return phone;
}

function webhookUrl(request) {
  if (process.env.WHATSAPP_WEBHOOK_URL) {
    return String(
      process.env.WHATSAPP_WEBHOOK_URL
    ).trim();
  }

  if (process.env.TWILIO_WEBHOOK_BASE_URL) {
    const base = String(
      process.env.TWILIO_WEBHOOK_BASE_URL
    ).replace(/\/+$/, "");

    const originalUrl = String(
      request.originalUrl || ""
    );

    const path = originalUrl.startsWith("/")
      ? originalUrl
      : `/${originalUrl}`;

    return `${base}${path}`;
  }

  const protocol = String(
    request.headers?.["x-forwarded-proto"] ||
      request.protocol ||
      "https"
  )
    .split(",")[0]
    .trim();

  return `${protocol}://${request.get(
    "host"
  )}${request.originalUrl}`;
}

function safeCompare(supplied, expected) {
  const left = Buffer.from(
    String(supplied || ""),
    "utf8"
  );

  const right = Buffer.from(
    String(expected || ""),
    "utf8"
  );

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    left,
    right
  );
}

function verifyTwilio(request) {
  const signature = text(
    request.headers?.["x-twilio-signature"]
  );

  const authToken = text(
    process.env.TWILIO_AUTH_TOKEN
  );

  if (!signature || !authToken) {
    return false;
  }

  return twilio.validateRequest(
    authToken,
    signature,
    webhookUrl(request),
    request.body || {}
  );
}

function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody;
  }

  if (
    typeof request.rawBody === "string"
  ) {
    return Buffer.from(
      request.rawBody,
      "utf8"
    );
  }

  return null;
}

function verifyMeta(request) {
  const signature = text(
    request.headers?.["x-hub-signature-256"]
  );

  const appSecret = text(
    process.env.META_WHATSAPP_APP_SECRET
  );

  const rawBody = rawRequestBody(
    request
  );

  if (
    !signature ||
    !appSecret ||
    !rawBody
  ) {
    return false;
  }

  const expected =
    `sha256=${crypto
      .createHmac(
        "sha256",
        appSecret
      )
      .update(rawBody)
      .digest("hex")}`;

  return safeCompare(
    signature,
    expected
  );
}

export function verifyWhatsAppWebhookRequest(
  request
) {
  const provider =
    getWhatsAppProviderName();

  if (provider === "console") {
    /*
     * The console provider may accept unsigned
     * webhook payloads during local development,
     * but never expose that behaviour in production.
     */
    return (
      String(
        process.env.NODE_ENV || ""
      )
        .trim()
        .toLowerCase() !==
      "production"
    );
  }

  if (provider === "twilio") {
    return verifyTwilio(request);
  }

  if (provider === "meta") {
    return verifyMeta(request);
  }

  return false;
}

export function verifyMetaWebhookSubscription(
  query = {}
) {
  if (
    getWhatsAppProviderName() !==
    "meta"
  ) {
    return {
      verified: false,
      challenge: "",
    };
  }

  const mode = text(
    query["hub.mode"]
  );

  const suppliedToken = text(
    query["hub.verify_token"]
  );

  const challenge = text(
    query["hub.challenge"]
  );

  const expectedToken = text(
    process.env.META_WHATSAPP_VERIFY_TOKEN
  );

  const verified =
    mode === "subscribe" &&
    Boolean(expectedToken) &&
    safeCompare(
      suppliedToken,
      expectedToken
    );

  return {
    verified,
    challenge:
      verified ? challenge : "",
  };
}

function normaliseTwilioMessages(
  body = {}
) {
  const message = text(
    body.Body ?? body.body
  ).replace(/\s+/g, " ");

  if (!message) {
    return [];
  }

  return [
    {
      phone: normalisePhone(
        body.From ?? body.phone
      ),

      message,

      providerMessageId: text(
        body.MessageSid ??
          body.SmsMessageSid ??
          body.providerMessageId
      ),

      displayName: text(
        body.ProfileName ??
          body.displayName
      )
        .replace(/\s+/g, " ")
        .slice(0, 120),
    },
  ];
}

function metaContactNames(value) {
  const names = new Map();

  const contacts = Array.isArray(
    value?.contacts
  )
    ? value.contacts
    : [];

  for (const contact of contacts) {
    const id = text(
      contact?.wa_id
    );

    if (!id) {
      continue;
    }

    names.set(
      id,
      text(
        contact?.profile?.name
      )
        .replace(/\s+/g, " ")
        .slice(0, 120)
    );
  }

  return names;
}

function normaliseMetaMessages(
  payload = {}
) {
  const output = [];

  const entries = Array.isArray(
    payload.entry
  )
    ? payload.entry
    : [];

  for (const entry of entries) {
    const changes = Array.isArray(
      entry?.changes
    )
      ? entry.changes
      : [];

    for (const change of changes) {
      const value =
        change?.value || {};

      const contactNames =
        metaContactNames(value);

      const messages = Array.isArray(
        value.messages
      )
        ? value.messages
        : [];

      for (const message of messages) {
        if (message?.type !== "text") {
          continue;
        }

        const body = text(
          message?.text?.body
        ).replace(/\s+/g, " ");

        if (!body) {
          continue;
        }

        const from = text(
          message?.from
        );

        output.push({
          phone:
            normalisePhone(from),

          message: body,

          providerMessageId:
            text(message?.id),

          displayName:
            contactNames.get(from) ||
            "",
        });
      }
    }
  }

  return output;
}

export function normaliseWhatsAppWebhookMessages(
  request
) {
  const provider =
    getWhatsAppProviderName();

  if (provider === "meta") {
    return normaliseMetaMessages(
      request.body || {}
    );
  }

  return normaliseTwilioMessages(
    request.body || {}
  );
}

export default {
  normaliseWhatsAppWebhookMessages,
  verifyMetaWebhookSubscription,
  verifyWhatsAppWebhookRequest,
};
