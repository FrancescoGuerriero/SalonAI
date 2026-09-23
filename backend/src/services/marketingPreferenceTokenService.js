import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  getLegalComplianceConfig,
} from "../config/legalComplianceConfig.js";

function text(value) {
  return String(value ?? "").trim();
}

function secret() {
  const value =
    getLegalComplianceConfig()
      .marketingPreferenceTokenSecret;

  if (value.length < 32) {
    const error =
      new Error(
        "Marketing preference links are unavailable until MARKETING_PREFERENCE_TOKEN_SECRET is configured with at least 32 characters."
      );
    error.statusCode = 503;
    error.code =
      "MARKETING_PREFERENCE_TOKEN_NOT_CONFIGURED";
    throw error;
  }

  return value;
}

function sign(encodedPayload) {
  return createHmac(
    "sha256",
    secret()
  )
    .update(
      `salonai-marketing-preferences:${encodedPayload}`,
      "utf8"
    )
    .digest("base64url");
}

export function createMarketingPreferenceToken({
  customerId,
} = {}) {
  const id = text(customerId);

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    const error =
      new Error(
        "A valid customer identifier is required for a marketing preference link."
      );
    error.statusCode = 400;
    error.code =
      "MARKETING_PREFERENCE_CUSTOMER_REQUIRED";
    throw error;
  }

  const payload = {
    v: 2,
    c: id.toLowerCase(),
  };

  const encoded =
    Buffer.from(
      JSON.stringify(payload),
      "utf8"
    ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifyMarketingPreferenceToken(
  token
) {
  const value = text(token);
  const [encoded, suppliedSignature, ...extra] =
    value.split(".");

  if (
    !encoded ||
    !suppliedSignature ||
    extra.length > 0
  ) {
    const error =
      new Error(
        "The marketing preference link is invalid."
      );
    error.statusCode = 400;
    error.code =
      "MARKETING_PREFERENCE_TOKEN_INVALID";
    throw error;
  }

  const expectedSignature =
    sign(encoded);

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );
  const suppliedBuffer =
    Buffer.from(
      suppliedSignature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
      suppliedBuffer.length ||
    !timingSafeEqual(
      expectedBuffer,
      suppliedBuffer
    )
  ) {
    const error =
      new Error(
        "The marketing preference link is invalid."
      );
    error.statusCode = 400;
    error.code =
      "MARKETING_PREFERENCE_TOKEN_INVALID";
    throw error;
  }

  let payload;

  try {
    payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      );
  } catch {
    const error =
      new Error(
        "The marketing preference link is invalid."
      );
    error.statusCode = 400;
    error.code =
      "MARKETING_PREFERENCE_TOKEN_INVALID";
    throw error;
  }

  if (
    payload?.v !== 2 ||
    !/^[a-fA-F0-9]{24}$/.test(
      text(payload?.c)
    )
  ) {
    const error =
      new Error(
        "The marketing preference link is invalid."
      );
    error.statusCode = 400;
    error.code =
      "MARKETING_PREFERENCE_TOKEN_INVALID";
    throw error;
  }

  return {
    v: 2,
    c: text(payload.c).toLowerCase(),
  };
}

export function tokenMatchesCustomer(
  payload,
  customer
) {
  return (
    text(payload?.c).toLowerCase() ===
    text(customer?._id).toLowerCase()
  );
}

export function buildMarketingPreferenceUrl(
  customer
) {
  const config =
    getLegalComplianceConfig();
  const token =
    createMarketingPreferenceToken({
      customerId:
        customer?._id,
    });

  return `${config.preferenceCenterUrl}/${encodeURIComponent(token)}`;
}

export function buildMarketingOneClickUnsubscribeUrl(
  customer,
  channel = "email"
) {
  const config =
    getLegalComplianceConfig();
  const token =
    createMarketingPreferenceToken({
      customerId:
        customer?._id,
    });
  const safeChannel =
    ["email", "sms", "whatsapp"].includes(
      String(channel || "").toLowerCase()
    )
      ? String(channel).toLowerCase()
      : "email";

  return `${config.publicApplicationUrl}/api/marketing-preferences/${encodeURIComponent(token)}/unsubscribe/${safeChannel}`;
}

export default {
  buildMarketingOneClickUnsubscribeUrl,
  buildMarketingPreferenceUrl,
  createMarketingPreferenceToken,
  tokenMatchesCustomer,
  verifyMarketingPreferenceToken,
};
