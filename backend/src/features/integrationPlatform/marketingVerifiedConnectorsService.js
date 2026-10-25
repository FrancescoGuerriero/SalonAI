import { createHash } from "node:crypto";
import mongoose from "mongoose";

import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import { storeProviderCredential } from "./providerCredentialService.js";

const APP_KEY = "marketing-data-connections";

const VERIFIED_CONNECTOR_DEFINITIONS = Object.freeze({
  github: Object.freeze({
    key: "github",
    label: "GitHub",
    category: "Data & developer infrastructure",
    description: "Connect a GitHub account and verify it against the authenticated-user REST endpoint.",
    documentationUrl: "https://docs.github.com/en/rest/users/users#get-the-authenticated-user",
    fields: [],
    credentials: [{ key: "accessToken", label: "GitHub access token", role: "access_token", required: true, secret: true }],
    scopes: ["read:user"],
  }),
  gitlab: Object.freeze({
    key: "gitlab",
    label: "GitLab",
    category: "Data & developer infrastructure",
    description: "Connect GitLab.com using an OAuth or personal access token and verify the authenticated user.",
    documentationUrl: "https://docs.gitlab.com/api/rest/authentication/",
    fields: [],
    credentials: [{ key: "accessToken", label: "GitLab access token", role: "access_token", required: true, secret: true }],
    scopes: ["read_api"],
  }),
  openai_ads: Object.freeze({
    key: "openai_ads",
    label: "OpenAI Ads / ChatGPT Ads",
    category: "Advertising",
    description: "Connect an OpenAI Ads account with its Advertiser API key and verify the key against GET /v1/ad_account.",
    documentationUrl: "https://developers.openai.com/ads/api-reference/authentication",
    fields: [],
    credentials: [{ key: "apiKey", label: "OpenAI Ads API key", role: "api_key", required: true, secret: true }],
    scopes: ["ad_account:read", "reporting:read"],
  }),
  paypal_transactions: Object.freeze({
    key: "paypal_transactions",
    label: "PayPal Transaction",
    category: "Finance & payments",
    description: "Connect PayPal REST APIs using a client ID and client secret verified through OAuth client credentials.",
    documentationUrl: "https://developer.paypal.com/api/rest/authentication/",
    fields: [
      { key: "clientId", label: "PayPal client ID", required: true, secret: false, placeholder: "" },
      { key: "environment", label: "Environment", required: true, secret: false, placeholder: "live", help: "Use live or sandbox." },
    ],
    credentials: [{ key: "clientSecret", label: "PayPal client secret", role: "client_secret", required: true, secret: true }],
    scopes: ["transactions:read"],
  }),
  sendgrid: Object.freeze({
    key: "sendgrid",
    label: "SendGrid",
    category: "CRM & automation",
    description: "Connect Twilio SendGrid with an API key and verify the authenticated user profile.",
    documentationUrl: "https://www.twilio.com/docs/sendgrid/for-developers/sending-email/authentication",
    fields: [],
    credentials: [{ key: "apiKey", label: "SendGrid API key", role: "api_key", required: true, secret: true }],
    scopes: ["user.profile.read"],
  }),
  square: Object.freeze({
    key: "square",
    label: "Square",
    category: "Finance & payments",
    description: "Connect a Square seller with an OAuth access token and verify seller locations through the Locations API.",
    documentationUrl: "https://developer.squareup.com/reference/square/locations/list-locations",
    fields: [],
    credentials: [{ key: "accessToken", label: "Square OAuth access token", role: "access_token", required: true, secret: true }],
    scopes: ["MERCHANT_PROFILE_READ"],
  }),
  twilio: Object.freeze({
    key: "twilio",
    label: "Twilio",
    category: "Communications & collaboration",
    description: "Connect Twilio with Account SID and Auth Token and verify the account through the Accounts REST resource.",
    documentationUrl: "https://www.twilio.com/docs/usage/requests-to-twilio",
    fields: [{ key: "accountSid", label: "Twilio Account SID", required: true, secret: false, placeholder: "AC..." }],
    credentials: [{ key: "authToken", label: "Twilio Auth Token", role: "client_secret", required: true, secret: true }],
    scopes: ["account:read"],
  }),
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function hash(value) {
  const normalised = text(value, 1000);
  return normalised ? createHash("sha256").update(normalised).digest("hex") : "";
}

function definition(provider) {
  const key = text(provider, 100).toLowerCase().replaceAll("-", "_");
  return VERIFIED_CONNECTOR_DEFINITIONS[key] || null;
}

function metadataFor(definitionValue, payload = {}) {
  const supplied = payload.account && typeof payload.account === "object" && !Array.isArray(payload.account)
    ? payload.account
    : payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};
  const metadata = { displayName: text(supplied.displayName ?? payload.displayName, 180) };
  for (const item of definitionValue.fields) {
    metadata[item.key] = text(supplied[item.key] ?? payload[item.key], 1000);
  }
  return metadata;
}

function storedRoles(connection) {
  return new Set((connection?.credentialBindings || []).filter((item) => item?.credential).map((item) => item.role));
}

function serialise(definitionValue, connection = null) {
  const roles = storedRoles(connection);
  const missingFields = definitionValue.fields.filter((item) => item.required && !text(connection?.metadata?.[item.key], 1000)).map((item) => item.key);
  const missingCredentials = definitionValue.credentials.filter((item) => item.required && !roles.has(item.role)).map((item) => item.key);
  const verified = connection?.metadata?.verificationStatus === "verified" && connection?.status === "connected";
  const readiness = !connection
    ? "not_connected"
    : ["disconnected", "revoked"].includes(connection.status)
      ? "disconnected"
      : verified
        ? "configured"
        : connection?.metadata?.verificationStatus === "failed"
          ? "verification_failed"
          : "verification_required";
  const metadata = {
    displayName: text(connection?.metadata?.displayName, 180),
    verifiedAccount: connection?.metadata?.verifiedAccount || null,
  };
  for (const item of definitionValue.fields) metadata[item.key] = text(connection?.metadata?.[item.key], 1000);
  return {
    provider: definitionValue.key,
    label: definitionValue.label,
    category: definitionValue.category,
    description: definitionValue.description,
    documentationUrl: definitionValue.documentationUrl,
    configurable: true,
    implementationStatus: "verified_account_connector",
    verificationAvailable: true,
    fields: definitionValue.fields.map((item) => ({ ...item })),
    credentials: definitionValue.credentials.map((item) => ({ ...item, stored: roles.has(item.role) })),
    scopes: [...definitionValue.scopes],
    connectionId: connection?._id || null,
    status: connection?.status || "disconnected",
    readiness,
    ready: verified && missingFields.length === 0 && missingCredentials.length === 0,
    verified,
    verifiedAt: connection?.metadata?.verifiedAt || null,
    missingFields,
    missingCredentials,
    metadata,
    connectedAt: connection?.connectedAt || null,
    disconnectedAt: connection?.disconnectedAt || null,
    tokenExpiresAt: connection?.tokenExpiresAt || null,
    liveSyncEnabled: false,
  };
}

async function appForBusiness(businessId, actorUser = null, { create = false } = {}) {
  if (!mongoose.isValidObjectId(businessId)) throw createServiceError("business must be a valid identifier.", 400);
  let app = await IntegrationApp.findOne({ business: businessId, key: APP_KEY });
  if (!app && create) {
    app = await IntegrationApp.create({
      business: businessId,
      key: APP_KEY,
      name: "Marketing data connections",
      description: "Tenant-owned verified provider connections for the AIIBP Marketing Data Hub.",
      ownerUser: mongoose.isValidObjectId(actorUser) ? actorUser : null,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      status: "active",
      scopes: ["analytics:read", "campaigns:read"],
      metadata: { managedBy: "marketing_connections_ui", liveSyncEnabled: false },
    });
  }
  return app;
}

export function verifiedMarketingConnectorDefinition(provider) {
  return definition(provider);
}

export function verifiedMarketingConnectorCatalogue() {
  return Object.values(VERIFIED_CONNECTOR_DEFINITIONS).map((item) => serialise(item));
}

export async function listVerifiedMarketingConnectors({ businessId } = {}) {
  const app = await appForBusiness(businessId);
  const providers = Object.keys(VERIFIED_CONNECTOR_DEFINITIONS);
  const connections = app
    ? await IntegrationConnection.find({ business: businessId, app: app._id, provider: { $in: providers } }).lean()
    : [];
  const byProvider = new Map(connections.map((entry) => [entry.provider, entry]));
  return Object.values(VERIFIED_CONNECTOR_DEFINITIONS).map((item) => serialise(item, byProvider.get(item.key) || null));
}

export async function configureVerifiedMarketingConnector(provider, payload = {}, { businessId, actorUser = null } = {}) {
  const definitionValue = definition(provider);
  if (!definitionValue) throw createServiceError("Verified marketing connector is not implemented.", 409, { code: "MARKETING_PROVIDER_VERIFIER_NOT_AVAILABLE" });
  const app = await appForBusiness(businessId, actorUser, { create: true });
  const metadata = metadataFor(definitionValue, payload);
  const missingFields = definitionValue.fields.filter((item) => item.required && !metadata[item.key]);
  if (missingFields.length) {
    throw createServiceError(`Required account details are missing: ${missingFields.map((item) => item.label).join(", ")}.`, 400, { missingFields: missingFields.map((item) => item.key) });
  }

  let connection = await IntegrationConnection.findOne({ business: businessId, app: app._id, provider: definitionValue.key, connectionKey: definitionValue.key });
  if (!connection) {
    connection = await IntegrationConnection.create({
      business: businessId,
      app: app._id,
      provider: definitionValue.key,
      connectionKey: definitionValue.key,
      status: "pending",
      scopes: definitionValue.scopes,
      metadata: { ...metadata, verificationStatus: "required", verifiedAt: null },
      externalAccountReferenceHash: hash(metadata[definitionValue.fields[0]?.key]),
    });
  } else {
    if (connection.status === "revoked") throw createServiceError(`${definitionValue.label} connection has been revoked and cannot be reused.`, 409);
    connection.metadata = { ...metadata, verificationStatus: "required", verifiedAt: null };
    connection.scopes = definitionValue.scopes;
    connection.externalAccountReferenceHash = hash(metadata[definitionValue.fields[0]?.key]);
    connection.status = "pending";
    connection.connectedAt = null;
    connection.disconnectedAt = null;
    await connection.save();
  }

  const secretPayload = payload.credentials && typeof payload.credentials === "object" && !Array.isArray(payload.credentials)
    ? payload.credentials
    : payload;
  for (const item of definitionValue.credentials) {
    const secret = text(secretPayload[item.key], 20000);
    if (!secret) continue;
    await storeProviderCredential(app._id, connection._id, {
      role: item.role,
      secret,
      expiresAt: item.role === "access_token" ? payload.tokenExpiresAt || null : null,
      metadata: { source: "marketing_connections_ui", provider: definitionValue.key, field: item.key },
    }, { businessId });
  }

  connection = await IntegrationConnection.findOne({ _id: connection._id, business: businessId, app: app._id });
  return serialise(definitionValue, connection);
}

export async function getVerifiedMarketingConnector(provider, { businessId } = {}) {
  const definitionValue = definition(provider);
  if (!definitionValue) return null;
  const app = await appForBusiness(businessId);
  const connection = app
    ? await IntegrationConnection.findOne({ business: businessId, app: app._id, provider: definitionValue.key, connectionKey: definitionValue.key }).lean()
    : null;
  return serialise(definitionValue, connection);
}

export async function disconnectVerifiedMarketingConnector(provider, { businessId } = {}) {
  const definitionValue = definition(provider);
  if (!definitionValue) throw createServiceError("Verified marketing connector is not implemented.", 409);
  const app = await appForBusiness(businessId);
  if (!app) throw createServiceError(`${definitionValue.label} is not connected.`, 404);
  const connection = await IntegrationConnection.findOne({ business: businessId, app: app._id, provider: definitionValue.key, connectionKey: definitionValue.key });
  if (!connection) throw createServiceError(`${definitionValue.label} is not connected.`, 404);

  const ids = (connection.credentialBindings || []).map((binding) => binding.credential).filter(Boolean);
  const now = new Date();
  if (ids.length) {
    await CredentialVersion.updateMany({ _id: { $in: ids }, business: businessId, app: app._id }, { $set: { status: "revoked", revokedAt: now, expiresAt: now } });
  }
  connection.credentialBindings = [];
  connection.status = "disconnected";
  connection.disconnectedAt = now;
  connection.connectedAt = null;
  connection.tokenExpiresAt = null;
  connection.metadata = { ...(connection.metadata?.toObject?.() || connection.metadata || {}), verificationStatus: "required", verifiedAt: null, verifiedAccount: null };
  await connection.save();
  return serialise(definitionValue, connection);
}

export default {
  configureVerifiedMarketingConnector,
  disconnectVerifiedMarketingConnector,
  getVerifiedMarketingConnector,
  listVerifiedMarketingConnectors,
  verifiedMarketingConnectorCatalogue,
  verifiedMarketingConnectorDefinition,
};