import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { env } from "../../config/env.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function signingSecret() {
  return String(
    process.env.BOOKING_RECOVERY_TOKEN_SECRET || env.jwtSecret || ""
  ).trim();
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
  } catch {
    throw createServiceError("The booking recovery link is invalid.", 400, {
      code: "BOOKING_RECOVERY_TOKEN_INVALID",
    });
  }
}

function signature(payload) {
  return createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
}

export function createBookingRecoveryToken(intent) {
  const expiresAt = new Date(intent?.recoverableUntil || 0);
  if (!intent?._id || Number.isNaN(expiresAt.getTime())) {
    throw createServiceError("Booking recovery token data is incomplete.", 500);
  }

  const payload = encode({
    v: 1,
    id: String(intent._id),
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  return `${payload}.${signature(payload)}`;
}

export function verifyBookingRecoveryToken(token) {
  const [payload, suppliedSignature, ...extra] = String(token || "").split(".");
  if (!payload || !suppliedSignature || extra.length > 0) {
    throw createServiceError("The booking recovery link is invalid.", 400, {
      code: "BOOKING_RECOVERY_TOKEN_INVALID",
    });
  }

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw createServiceError("The booking recovery link is invalid.", 400, {
      code: "BOOKING_RECOVERY_TOKEN_INVALID",
    });
  }

  const decoded = decode(payload);
  if (decoded?.v !== 1 || !decoded?.id || !Number.isFinite(Number(decoded?.exp))) {
    throw createServiceError("The booking recovery link is invalid.", 400, {
      code: "BOOKING_RECOVERY_TOKEN_INVALID",
    });
  }
  if (Number(decoded.exp) * 1000 <= Date.now()) {
    throw createServiceError("The booking recovery link has expired.", 410, {
      code: "BOOKING_RECOVERY_TOKEN_EXPIRED",
    });
  }

  return Object.freeze({
    intentId: String(decoded.id),
    expiresAt: new Date(Number(decoded.exp) * 1000),
  });
}

export function bookingRecoveryUrl(intent) {
  const token = createBookingRecoveryToken(intent);
  const url = new URL("/booking", env.frontendUrl);
  url.searchParams.set("recovery", token);
  return url.toString();
}

export default Object.freeze({
  bookingRecoveryUrl,
  createBookingRecoveryToken,
  verifyBookingRecoveryToken,
});
