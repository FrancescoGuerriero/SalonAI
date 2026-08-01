import crypto from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
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
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message: "Too many authentication attempts.",
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
