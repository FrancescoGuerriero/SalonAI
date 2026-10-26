import mongoose from "mongoose";

import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  hashIntegrationSecret,
} from "./integrationSecrets.js";

const ROLE_TO_TYPE = Object.freeze({
  access_token: "oauth_access_token",
  refresh_token: "oauth_refresh_token",
  client_secret: "oauth_client_secret",
  api_key: "provider_api_key",
  access_token_secret: "service_key",
  consumer_secret: "service_key",
  secret_access_key: "service_key",
  session_token: "service_key",
  private_key: "service_key",
  signing_key: "webhook_signing",
  password: "service_key",
  service_account_json: "service_key",
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function date(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function bindingRole(value) {
  const role = text(value, 80).toLowerCase().replaceAll("-", "_");
  if (!ROLE_TO_TYPE[role]) {
    throw createServiceError(
      `role must be one of: ${Object.keys(ROLE_TO_TYPE).join(", ")}.`,
      400,
      { field: "role" }
    );
  }
  return role;
}

async function connectionForBusiness(appId, connectionId, businessId) {
  objectId(appId, "app");
  objectId(connectionId, "connection");
  objectId(businessId, "business");

  const [app, connection] = await Promise.all([
    IntegrationApp.findOne({ _id: appId, business: businessId }),
    IntegrationConnection.findOne({
      _id: connectionId,
      business: businessId,
      app: appId,
    }),
  ]);
  if (!app) throw createServiceError("Integration app not found.", 404);
  if (!connection) throw createServiceError("Integration connection not found.", 404);
  if (app.status === "revoked" || connection.status === "revoked") {
    throw createServiceError("Provider credentials cannot be changed on a revoked integration.", 409);
  }
  return { app, connection };
}

function serialiseCredential(credential) {
  const value = typeof credential?.toObject === "function"
    ? credential.toObject()
    : { ...(credential || {}) };
  delete value.secretHash;
  delete value.secretCiphertext;
  delete value.secretIv;
  delete value.secretTag;
  return value;
}

function setConnectionBinding(connection, role, credentialId) {
  const existing = Array.isArray(connection.credentialBindings)
    ? connection.credentialBindings.filter((binding) => binding.role !== role)
    : [];
  connection.credentialBindings = [
    ...existing,
    { role, credential: credentialId },
  ];
}

export async function storeProviderCredential(
  appId,
  connectionId,
  payload = {},
  { businessId } = {}
) {
  const { connection } = await connectionForBusiness(appId, connectionId, businessId);
  const role = bindingRole(payload.role);
  const credentialType = ROLE_TO_TYPE[role];
  const secret = text(payload.secret, 50000);
  if (!secret) {
    throw createServiceError("Provider credential secret is required.", 400, { field: "secret" });
  }

  const expiresAt = date(payload.expiresAt, "expiresAt");
  const latest = await CredentialVersion.findOne({
    business: businessId,
    app: appId,
    credentialType,
  }).sort({ version: -1 }).select("version");
  const version = Number(latest?.version || 0) + 1;

  const prior = await CredentialVersion.find({
    business: businessId,
    app: appId,
    credentialType,
    status: { $in: ["active", "retiring"] },
    "metadata.connectionId": String(connection._id),
    "metadata.bindingRole": role,
  });
  for (const credential of prior) {
    credential.status = "revoked";
    credential.revokedAt = new Date();
    credential.expiresAt = credential.expiresAt || new Date();
    await credential.save();
  }

  const encrypted = encryptIntegrationSecret(secret);
  const credential = await CredentialVersion.create({
    business: businessId,
    app: appId,
    credentialType,
    version,
    keyPrefix: "",
    secretHash: hashIntegrationSecret(secret),
    secretCiphertext: encrypted.ciphertext,
    secretIv: encrypted.iv,
    secretTag: encrypted.tag,
    status: "active",
    validFrom: new Date(),
    expiresAt,
    metadata: {
      ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
      provider: connection.provider,
      connectionId: String(connection._id),
      bindingRole: role,
    },
  });

  setConnectionBinding(connection, role, credential._id);
  if (role === "access_token") connection.tokenExpiresAt = expiresAt;

  if (!["revoked", "disconnected"].includes(connection.status)) {
    connection.status = "pending";
  }
  connection.connectedAt = null;
  connection.metadata = {
    ...(connection.metadata?.toObject?.() || connection.metadata || {}),
    verificationStatus: "required",
    verifiedAt: null,
    verifiedAccount: null,
  };
  await connection.save();

  return {
    credential: serialiseCredential(credential),
    connection: {
      _id: connection._id,
      provider: connection.provider,
      connectionKey: connection.connectionKey,
      status: connection.status,
      tokenExpiresAt: connection.tokenExpiresAt,
      credentialBindings: connection.credentialBindings,
      verificationStatus: connection.metadata?.verificationStatus || "required",
    },
    secretStored: true,
    secretReturned: false,
  };
}

export async function resolveProviderCredential(
  connection,
  role,
  { allowExpired = false, markUsed = true } = {}
) {
  const normalisedRole = bindingRole(role);
  const binding = (connection?.credentialBindings || []).find(
    (item) => item.role === normalisedRole
  );
  if (!binding?.credential) {
    throw createServiceError(`Provider credential is not bound for role: ${role}.`, 409, {
      code: "PROVIDER_CREDENTIAL_NOT_BOUND",
      role: normalisedRole,
    });
  }

  const credential = await CredentialVersion.findOne({
    _id: binding.credential,
    business: connection.business,
    app: connection.app,
    status: { $in: ["active", "retiring"] },
  }).select("+secretHash +secretCiphertext +secretIv +secretTag");
  if (!credential) {
    throw createServiceError(`Provider credential is unavailable for role: ${role}.`, 409, {
      code: "PROVIDER_CREDENTIAL_UNAVAILABLE",
      role: normalisedRole,
    });
  }
  const now = new Date();
  if (!allowExpired && credential.expiresAt && credential.expiresAt <= now) {
    throw createServiceError(`Provider credential has expired for role: ${role}.`, 409, {
      code: "PROVIDER_CREDENTIAL_EXPIRED",
      role: normalisedRole,
    });
  }

  const secret = decryptIntegrationSecret({
    ciphertext: credential.secretCiphertext,
    iv: credential.secretIv,
    tag: credential.secretTag,
  });
  if (markUsed) {
    await CredentialVersion.updateOne({ _id: credential._id }, { $set: { lastUsedAt: now } });
  }
  return {
    secret,
    credential: serialiseCredential(credential),
  };
}

export async function providerCredentialBindings(
  appId,
  connectionId,
  { businessId } = {}
) {
  const { connection } = await connectionForBusiness(appId, connectionId, businessId);
  const ids = connection.credentialBindings.map((item) => item.credential).filter(Boolean);
  const credentials = ids.length
    ? await CredentialVersion.find({ _id: { $in: ids }, business: businessId, app: appId }).lean()
    : [];
  const byId = new Map(credentials.map((credential) => [String(credential._id), serialiseCredential(credential)]));
  return connection.credentialBindings.map((binding) => ({
    role: binding.role,
    credential: byId.get(String(binding.credential)) || null,
  }));
}

export default {
  providerCredentialBindings,
  resolveProviderCredential,
  storeProviderCredential,
};