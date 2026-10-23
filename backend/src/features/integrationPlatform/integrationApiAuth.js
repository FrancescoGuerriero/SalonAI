import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationRateLimitBucket from "../../models/IntegrationRateLimitBucket.js";
import {
  integrationSecretMatches,
} from "./integrationSecrets.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

const API_CREDENTIAL_TYPES = ["api_key", "service_key"];
export const API_RATE_LIMIT_CONTRACT_VERSION = "1.0.0";

function text(value) {
  return String(value ?? "").trim();
}

function bearerSecret(request) {
  const authorization = text(request.headers?.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? text(match[1]) : "";
}

function keyPrefix(secret) {
  return text(secret).split(".")[0]?.toLowerCase() || "";
}

function credentialUsable(credential, at = new Date()) {
  if (!credential) return false;
  if (!["active", "retiring"].includes(credential.status)) return false;
  if (credential.validFrom && new Date(credential.validFrom) > at) return false;
  if (credential.expiresAt && new Date(credential.expiresAt) <= at) return false;
  if (
    credential.status === "retiring" &&
    credential.retireAfter &&
    new Date(credential.retireAfter) <= at
  ) {
    return false;
  }
  return true;
}

function scopeMatches(granted, required) {
  if (granted === "*") return true;
  if (granted === required) return true;
  if (granted.endsWith(":*")) {
    return required.startsWith(granted.slice(0, -1));
  }
  return false;
}

export function hasIntegrationScope(grantedScopes = [], requiredScope) {
  const required = text(requiredScope).toLowerCase();
  if (!required) return true;
  return (Array.isArray(grantedScopes) ? grantedScopes : []).some((scope) =>
    scopeMatches(text(scope).toLowerCase(), required)
  );
}

async function incrementRateBucket({
  businessId,
  appId,
  endpointKey,
  requests,
  windowSeconds,
  now,
}) {
  const windowMs = Math.max(1, Number(windowSeconds) || 60) * 1000;
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs * 2);
  const match = {
    business: businessId,
    app: appId,
    endpointKey,
    windowStart,
  };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt },
  };

  let bucket;
  try {
    bucket = await IntegrationRateLimitBucket.findOneAndUpdate(match, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    bucket = await IntegrationRateLimitBucket.findOneAndUpdate(match, {
      $inc: { count: 1 },
    }, { new: true }).lean();
  }

  const limit = Math.max(1, Number(requests) || 600);
  return {
    count: Number(bucket?.count || 0),
    limit,
    remaining: Math.max(0, limit - Number(bucket?.count || 0)),
    resetAt: new Date(windowStartMs + windowMs),
  };
}

export async function authenticateIntegrationApp(request, response, next) {
  try {
    const secret = bearerSecret(request);
    const prefix = keyPrefix(secret);
    if (!secret || !prefix) {
      throw createServiceError(
        "A valid integration Bearer credential is required.",
        401
      );
    }

    const now = new Date();
    const credential = await CredentialVersion.findOne({
      keyPrefix: prefix,
      credentialType: { $in: API_CREDENTIAL_TYPES },
      status: { $in: ["active", "retiring"] },
    }).select("+secretHash");

    if (
      !credentialUsable(credential, now) ||
      !integrationSecretMatches(secret, credential?.secretHash)
    ) {
      throw createServiceError("Integration credential is invalid or expired.", 401);
    }

    const app = await IntegrationApp.findOne({
      _id: credential.app,
      business: credential.business,
      status: "active",
    }).lean();

    if (!app) {
      throw createServiceError("Integration app is not active.", 403);
    }

    const endpointKey = `${String(request.method || "GET").toUpperCase()}:${text(
      request.baseUrl
    )}${text(request.path || "/")}`.slice(0, 300);

    const rate = await incrementRateBucket({
      businessId: app.business,
      appId: app._id,
      endpointKey,
      requests: app.ratePolicy?.requests,
      windowSeconds: app.ratePolicy?.windowSeconds,
      now,
    });
    const ratePolicyVersion = text(app.ratePolicy?.version) || API_RATE_LIMIT_CONTRACT_VERSION;

    response.setHeader("X-RateLimit-Policy-Version", ratePolicyVersion);
    response.setHeader("X-RateLimit-Limit", String(rate.limit));
    response.setHeader("X-RateLimit-Remaining", String(rate.remaining));
    response.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(rate.resetAt.getTime() / 1000))
    );

    if (rate.count > rate.limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rate.resetAt.getTime() - now.getTime()) / 1000)
      );
      response.setHeader("Retry-After", String(retryAfter));
      return response.status(429).json({
        success: false,
        code: "INTEGRATION_RATE_LIMIT_EXCEEDED",
        message: "Integration app rate limit exceeded.",
        ratePolicyVersion,
        retryAfter,
      });
    }

    request.integrationAuth = Object.freeze({
      businessId: String(app.business),
      appId: String(app._id),
      appKey: app.key,
      environment: app.environment,
      credentialId: String(credential._id),
      credentialVersion: credential.version,
      scopes: Object.freeze([...(app.scopes || [])]),
      ratePolicy: Object.freeze({
        version: ratePolicyVersion,
        requests: rate.limit,
        windowSeconds: Number(app.ratePolicy?.windowSeconds || 60),
      }),
    });

    await Promise.all([
      CredentialVersion.updateOne(
        { _id: credential._id },
        { $set: { lastUsedAt: now } }
      ),
      IntegrationApp.updateOne(
        { _id: app._id },
        { $set: { lastUsedAt: now } }
      ),
    ]);

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireIntegrationScopes(...requiredScopes) {
  const required = requiredScopes.map((scope) => text(scope).toLowerCase()).filter(Boolean);

  return function integrationScopeGuard(request, response, next) {
    const granted = request.integrationAuth?.scopes || [];
    const missing = required.filter(
      (scope) => !hasIntegrationScope(granted, scope)
    );

    if (missing.length > 0) {
      return response.status(403).json({
        success: false,
        code: "INTEGRATION_SCOPE_REQUIRED",
        message: "The integration app does not have the required scope.",
        requiredScopes: missing,
      });
    }

    return next();
  };
}

export default Object.freeze({
  API_RATE_LIMIT_CONTRACT_VERSION,
  authenticateIntegrationApp,
  hasIntegrationScope,
  requireIntegrationScopes,
});
