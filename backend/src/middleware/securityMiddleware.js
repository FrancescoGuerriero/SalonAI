import crypto from "node:crypto";
import helmet from "helmet";
import {
  ipKeyGenerator,
  rateLimit,
} from "express-rate-limit";

import { env } from "../config/env.js";

export const securityHeaders = helmet({
  crossOriginResourcePolicy: {
    policy: "cross-origin",
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", env.frontendUrl],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: {
    policy: "no-referrer",
  },
});

function firstForwardedAddress(req) {
  const header = req.headers?.["x-forwarded-for"];

  if (Array.isArray(header)) {
    return String(header[0] || "").split(",")[0].trim();
  }

  return String(header || "").split(",")[0].trim();
}

function normalizedIpKey(value) {
  const ip = String(value || "").trim();
  return ip ? ipKeyGenerator(ip, 56) : "unknown-client";
}

export function rateLimitKey(req) {
  /*
   * SalonAI production is served through the trusted nginx edge container.
   * nginx supplies the original remote address in X-Forwarded-For. Using that
   * address avoids placing every browser into the edge-container rate bucket.
   * ipKeyGenerator also preserves express-rate-limit's IPv6 subnet handling.
   */
  if (env.isProduction) {
    const forwardedAddress = firstForwardedAddress(req);
    if (forwardedAddress) return normalizedIpKey(forwardedAddress);
  }

  return normalizedIpKey(
    req.ip || req.socket?.remoteAddress
  );
}

function skipNonActionRequest(req) {
  return req.method === "OPTIONS" || req.method === "HEAD";
}

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: skipNonActionRequest,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: skipNonActionRequest,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message: "Too many authentication attempts.",
  },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: skipNonActionRequest,
  message: {
    success: false,
    code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
    message: "Too many password reset attempts. Please try again later.",
  },
});

export function requestIdMiddleware(req, res, next) {
  const requestId =
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  req.requestId = String(requestId);
  res.setHeader("X-Request-ID", req.requestId);
  next();
}

export function preventParameterPollution(req, res, next) {
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) {
      req.query[key] = value.at(-1);
    }
  }
  next();
}

export function noStoreSensitiveResponses(req, res, next) {
  if (
    req.path.includes("/auth") ||
    req.path.includes("/customers") ||
    req.path.includes("/audit")
  ) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}
