import { createHash } from "node:crypto";
import mongoose from "mongoose";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import WebhookDelivery from "../../models/WebhookDelivery.js";
import WebhookSubscription from "../../models/WebhookSubscription.js";
import {
  domainEventDefinition,
  listDomainEventSchemas,
} from "./domainEventCatalogue.js";
import {
  encryptIntegrationSecret,
  generateIntegrationSecret,
  hashIntegrationSecret,
} from "./integrationSecrets.js";
import {
  replayWebhookDelivery,
} from "./webhookProjectionService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const APP_STATUSES = ["draft", "active", "suspended", "revoked"];
const APP_ENVIRONMENTS = ["development", "staging", "production"];
const CREDENTIAL_TYPES = [
  "api_key",
  "service_key",
  "webhook_signing",
  "oauth_client_secret",
];
const CONNECTION_STATUSES = [
  "pending",
  "connected",
  "degraded",
  "disconnected",
  "revoked",
];
const SUBSCRIPTION_STATUSES = ["active", "paused", "disabled"];

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function enumValue(value, field, allowed, fallback) {
  const normalised = text(value || fallback).toLowerCase().replaceAll("-", "_");
  if (!allowed.includes(normalised)) {
    throw createServiceError(`${field} must be one of: ${allowed.join(", ")}.`, 400, {
      field,
    });
  }
  return normalised;
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item))
    .filter(Boolean))];
}

function positiveInteger(value, fallback, { min = 1, max = 1000000 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function date(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function hashReference(value) {
  const normalised = text(value);
  return normalised
    ? createHash("sha256").update(normalised).digest("hex")
    : "";
}

function serialiseCredential(credential) {
  const value =
    typeof credential?.toObject === "function"
      ? credential.toObject()
      : { ...(credential || {}) };
  delete value.secretHash;
  delete value.secretCiphertext;
  delete value.secretIv;
  delete value.secretTag;
  return value;
}

async function appForBusiness(appId, businessId) {
  objectId(appId, "app");
  objectId(businessId, "business");
  return assertFound(
    await IntegrationApp.findOne({ _id: appId, business: businessId }),
    "Integration app not found."
  );
}

function normaliseEventSelectors(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw createServiceError(
      "At least one webhook event schema is required.",
      400,
      { field: "events" }
    );
  }

  const values = [];
  const seen = new Set();
  for (const event of events) {
    const type = text(event?.type || event).toLowerCase();
    const version = text(event?.version || "1");
    if (type !== "*") {
      domainEventDefinition(type, version);
    } else if (!version) {
      throw createServiceError("Wildcard event version is required.", 400, {
        field: "events",
      });
    }

    const key = `${type}@${version}`;
    if (!seen.has(key)) {
      seen.add(key);
      values.push({ type, version });
    }
  }
  return values;
}

export async function createIntegrationApp(payload = {}, { businessId, ownerUser = null } = {}) {
  objectId(businessId, "business");
  const name = text(payload.name);
  const key = slug(payload.key || name);
  if (!name || !key) {
    throw createServiceError("Integration app name is required.", 400, {
      field: "name",
    });
  }

  return IntegrationApp.create({
    business: businessId,
    key,
    name,
    description: text(payload.description),
    ownerUser: mongoose.isValidObjectId(ownerUser) ? ownerUser : null,
    environment: enumValue(
      payload.environment,
      "environment",
      APP_ENVIRONMENTS,
      "development"
    ),
    status: enumValue(payload.status, "status", APP_STATUSES, "draft"),
    scopes: uniqueStrings(payload.scopes),
    redirectUris: uniqueStrings(payload.redirectUris),
    allowedOrigins: uniqueStrings(payload.allowedOrigins),
    ratePolicy: {
      requests: positiveInteger(payload.ratePolicy?.requests, 600),
      windowSeconds: positiveInteger(
        payload.ratePolicy?.windowSeconds,
        60,
        { max: 86400 }
      ),
    },
    metadata: payload.metadata || {},
  });
}

export async function listIntegrationApps(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) {
    match.status = enumValue(query.status, "status", APP_STATUSES, "active");
  }
  if (query.environment) {
    match.environment = enumValue(
      query.environment,
      "environment",
      APP_ENVIRONMENTS,
      "development"
    );
  }
  return IntegrationApp.find(match).sort({ name: 1, _id: 1 }).lean();
}

export async function updateIntegrationApp(appId, payload = {}, { businessId } = {}) {
  const app = await appForBusiness(appId, businessId);
  if (payload.name !== undefined) app.name = text(payload.name);
  if (payload.description !== undefined) app.description = text(payload.description);
  if (payload.status !== undefined) {
    app.status = enumValue(payload.status, "status", APP_STATUSES, app.status);
  }
  if (payload.environment !== undefined) {
    app.environment = enumValue(
      payload.environment,
      "environment",
      APP_ENVIRONMENTS,
      app.environment
    );
  }
  if (payload.scopes !== undefined) app.scopes = uniqueStrings(payload.scopes);
  if (payload.redirectUris !== undefined) {
    app.redirectUris = uniqueStrings(payload.redirectUris);
  }
  if (payload.allowedOrigins !== undefined) {
    app.allowedOrigins = uniqueStrings(payload.allowedOrigins);
  }
  if (payload.ratePolicy !== undefined) {
    app.ratePolicy = {
      requests: positiveInteger(payload.ratePolicy?.requests, app.ratePolicy?.requests || 600),
      windowSeconds: positiveInteger(
        payload.ratePolicy?.windowSeconds,
        app.ratePolicy?.windowSeconds || 60,
        { max: 86400 }
      ),
    };
  }
  if (payload.metadata !== undefined) app.metadata = payload.metadata || {};
  await app.save();
  return app.toObject();
}

export async function issueIntegrationCredential(
  appId,
  payload = {},
  { businessId } = {}
) {
  const app = await appForBusiness(appId, businessId);
  if (app.status === "revoked") {
    throw createServiceError("Credentials cannot be issued for a revoked app.", 409);
  }

  const credentialType = enumValue(
    payload.credentialType,
    "credentialType",
    CREDENTIAL_TYPES,
    "api_key"
  );
  const latest = await CredentialVersion.findOne({
    business: businessId,
    app: app._id,
    credentialType,
  })
    .sort({ version: -1 })
    .select("version");

  const version = Number(latest?.version || 0) + 1;
  const generated = generateIntegrationSecret(
    credentialType === "webhook_signing" ? "whsec" : "aibp"
  );
  const encrypted = encryptIntegrationSecret(generated.secret);
  const expiresAt = date(payload.expiresAt, "expiresAt");
  const overlapSeconds = positiveInteger(
    payload.overlapSeconds,
    300,
    { min: 0, max: 86400 }
  );
  const retireAt = new Date(Date.now() + overlapSeconds * 1000);

  const prior = await CredentialVersion.find({
    business: businessId,
    app: app._id,
    credentialType,
    status: "active",
  });

  for (const credential of prior) {
    credential.status = "retiring";
    credential.retireAfter = retireAt;
    if (!credential.expiresAt || credential.expiresAt > retireAt) {
      credential.expiresAt = retireAt;
    }
    await credential.save();
  }

  const credential = await CredentialVersion.create({
    business: businessId,
    app: app._id,
    credentialType,
    version,
    keyPrefix: generated.keyPrefix,
    secretHash: hashIntegrationSecret(generated.secret),
    secretCiphertext: encrypted.ciphertext,
    secretIv: encrypted.iv,
    secretTag: encrypted.tag,
    status: "active",
    validFrom: new Date(),
    expiresAt,
    metadata: payload.metadata || {},
  });

  return {
    credential: serialiseCredential(credential),
    secret: generated.secret,
    secretReturnedOnce: true,
  };
}

export async function listIntegrationCredentials(appId, { businessId } = {}) {
  const app = await appForBusiness(appId, businessId);
  const items = await CredentialVersion.find({
    business: businessId,
    app: app._id,
  })
    .sort({ credentialType: 1, version: -1 })
    .lean();
  return items.map(serialiseCredential);
}

export async function revokeIntegrationCredential(
  appId,
  credentialId,
  { businessId } = {}
) {
  const app = await appForBusiness(appId, businessId);
  objectId(credentialId, "credential");
  const credential = assertFound(
    await CredentialVersion.findOne({
      _id: credentialId,
      business: businessId,
      app: app._id,
    }),
    "Integration credential not found."
  );
  credential.status = "revoked";
  credential.revokedAt = new Date();
  credential.expiresAt = new Date();
  await credential.save();
  return serialiseCredential(credential);
}

export async function createIntegrationConnection(
  appId,
  payload = {},
  { businessId } = {}
) {
  const app = await appForBusiness(appId, businessId);
  const provider = text(payload.provider).toLowerCase();
  const connectionKey = slug(payload.connectionKey || payload.name || provider);
  if (!provider || !connectionKey) {
    throw createServiceError("Provider and connection key are required.", 400);
  }
  return IntegrationConnection.create({
    business: businessId,
    app: app._id,
    provider,
    connectionKey,
    status: enumValue(
      payload.status,
      "status",
      CONNECTION_STATUSES,
      "pending"
    ),
    scopes: uniqueStrings(payload.scopes),
    externalAccountReferenceHash: hashReference(payload.externalAccountReference),
    connectedAt:
      payload.status === "connected" ? new Date() : date(payload.connectedAt, "connectedAt"),
    tokenExpiresAt: date(payload.tokenExpiresAt, "tokenExpiresAt"),
    metadata: payload.metadata || {},
  });
}

export async function listIntegrationConnections(appId, { businessId } = {}) {
  const app = await appForBusiness(appId, businessId);
  return IntegrationConnection.find({ business: businessId, app: app._id })
    .sort({ provider: 1, connectionKey: 1 })
    .lean();
}

export async function createWebhookSubscription(
  appId,
  payload = {},
  { businessId } = {}
) {
  const app = await appForBusiness(appId, businessId);
  objectId(payload.signingCredential, "signingCredential");
  const credential = await CredentialVersion.findOne({
    _id: payload.signingCredential,
    business: businessId,
    app: app._id,
    credentialType: "webhook_signing",
    status: { $in: ["active", "retiring"] },
  });
  assertFound(credential, "Webhook signing credential not found.");

  return WebhookSubscription.create({
    business: businessId,
    app: app._id,
    name: text(payload.name || "Webhook"),
    endpointUrl: text(payload.endpointUrl),
    status: enumValue(
      payload.status,
      "status",
      SUBSCRIPTION_STATUSES,
      "active"
    ),
    events: normaliseEventSelectors(payload.events),
    signingCredential: credential._id,
    retryPolicy: {
      maxAttempts: positiveInteger(payload.retryPolicy?.maxAttempts, 8, { max: 20 }),
      baseDelaySeconds: positiveInteger(
        payload.retryPolicy?.baseDelaySeconds,
        30,
        { max: 3600 }
      ),
      maxDelaySeconds: positiveInteger(
        payload.retryPolicy?.maxDelaySeconds,
        3600,
        { max: 86400 }
      ),
    },
    metadata: payload.metadata || {},
  });
}

export async function listWebhookSubscriptions(appId, { businessId } = {}) {
  const app = await appForBusiness(appId, businessId);
  return WebhookSubscription.find({ business: businessId, app: app._id })
    .populate("signingCredential", "credentialType version keyPrefix status validFrom expiresAt retireAfter lastUsedAt")
    .sort({ createdAt: -1 })
    .lean();
}

export async function updateWebhookSubscription(
  appId,
  subscriptionId,
  payload = {},
  { businessId } = {}
) {
  const app = await appForBusiness(appId, businessId);
  objectId(subscriptionId, "subscription");
  const subscription = assertFound(
    await WebhookSubscription.findOne({
      _id: subscriptionId,
      business: businessId,
      app: app._id,
    }),
    "Webhook subscription not found."
  );

  if (payload.name !== undefined) subscription.name = text(payload.name);
  if (payload.endpointUrl !== undefined) {
    subscription.endpointUrl = text(payload.endpointUrl);
  }
  if (payload.status !== undefined) {
    subscription.status = enumValue(
      payload.status,
      "status",
      SUBSCRIPTION_STATUSES,
      subscription.status
    );
  }
  if (payload.events !== undefined) {
    subscription.events = normaliseEventSelectors(payload.events);
  }
  if (payload.retryPolicy !== undefined) {
    subscription.retryPolicy = {
      maxAttempts: positiveInteger(
        payload.retryPolicy?.maxAttempts,
        subscription.retryPolicy?.maxAttempts || 8,
        { max: 20 }
      ),
      baseDelaySeconds: positiveInteger(
        payload.retryPolicy?.baseDelaySeconds,
        subscription.retryPolicy?.baseDelaySeconds || 30,
        { max: 3600 }
      ),
      maxDelaySeconds: positiveInteger(
        payload.retryPolicy?.maxDelaySeconds,
        subscription.retryPolicy?.maxDelaySeconds || 3600,
        { max: 86400 }
      ),
    };
  }
  await subscription.save();
  return subscription.toObject();
}

export async function listWebhookDeliveries(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.app) match.app = objectId(query.app, "app");
  if (query.subscription) {
    match.subscription = objectId(query.subscription, "subscription");
  }
  if (query.status) match.status = text(query.status).toLowerCase();
  if (query.eventType) match.eventType = text(query.eventType).toLowerCase();
  return WebhookDelivery.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(positiveInteger(query.limit, 100, { max: 500 }))
    .lean();
}

export async function replayTenantWebhookDelivery(deliveryId, { businessId } = {}) {
  objectId(deliveryId, "delivery");
  objectId(businessId, "business");
  const delivery = assertFound(
    await WebhookDelivery.findOne({ _id: deliveryId, business: businessId }).lean(),
    "Webhook delivery not found."
  );
  return replayWebhookDelivery(delivery._id);
}

export async function listConnectorHealth(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.app) match.app = objectId(query.app, "app");
  return ConnectorHealth.find(match)
    .sort({ status: 1, updatedAt: -1 })
    .populate("app", "key name environment status")
    .lean();
}

export function integrationEventCatalogue() {
  return listDomainEventSchemas();
}

export default {
  createIntegrationApp,
  createIntegrationConnection,
  createWebhookSubscription,
  integrationEventCatalogue,
  issueIntegrationCredential,
  listConnectorHealth,
  listIntegrationApps,
  listIntegrationConnections,
  listIntegrationCredentials,
  listWebhookDeliveries,
  listWebhookSubscriptions,
  replayTenantWebhookDelivery,
  revokeIntegrationCredential,
  updateIntegrationApp,
  updateWebhookSubscription,
};
