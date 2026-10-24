import { createHash } from "node:crypto";
import mongoose from "mongoose";

import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import { storeProviderCredential } from "./providerCredentialService.js";

const SOCIAL_ACCOUNTS_APP_KEY = "social-connected-accounts";

const PROVIDERS = Object.freeze({
  facebook: Object.freeze({
    key: "facebook",
    label: "Facebook",
    description: "Connect the Facebook Page used for governed social publishing.",
    fields: Object.freeze([
      Object.freeze({
        key: "pageId",
        label: "Facebook Page ID",
        placeholder: "123456789012345",
      }),
    ]),
  }),
  instagram: Object.freeze({
    key: "instagram",
    label: "Instagram",
    description: "Connect an Instagram professional account used for governed publishing.",
    fields: Object.freeze([
      Object.freeze({
        key: "instagramProfessionalAccountId",
        label: "Instagram professional account ID",
        placeholder: "17841400000000000",
      }),
    ]),
  }),
  linkedin: Object.freeze({
    key: "linkedin",
    label: "LinkedIn",
    description: "Connect the LinkedIn member or organisation identity used to publish.",
    fields: Object.freeze([
      Object.freeze({
        key: "authorUrn",
        label: "LinkedIn author URN",
        placeholder: "urn:li:organization:123456",
      }),
    ]),
  }),
  google_business_profile: Object.freeze({
    key: "google_business_profile",
    label: "Google Business Profile",
    description: "Connect the Google Business Profile location used for business posts.",
    fields: Object.freeze([
      Object.freeze({
        key: "accountId",
        label: "Google Business account ID",
        placeholder: "accounts/123456789",
      }),
      Object.freeze({
        key: "locationId",
        label: "Google Business location ID",
        placeholder: "locations/987654321",
      }),
    ]),
  }),
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

function providerDefinition(value) {
  const key = text(value, 80).toLowerCase().replaceAll("-", "_");
  const definition = PROVIDERS[key];
  if (!definition) {
    throw createServiceError(
      `Unsupported connected-account provider: ${key || "unknown"}.`,
      400,
      { field: "provider", code: "CONNECTED_ACCOUNT_PROVIDER_UNSUPPORTED" }
    );
  }
  return definition;
}

function date(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function hashReference(value) {
  const normalised = text(value, 1000);
  return normalised ? createHash("sha256").update(normalised).digest("hex") : "";
}

function accountMetadata(definition, payload = {}) {
  const supplied =
    payload.account && typeof payload.account === "object" && !Array.isArray(payload.account)
      ? payload.account
      : payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {};

  const metadata = {
    displayName: text(supplied.displayName ?? payload.displayName, 180),
  };
  for (const field of definition.fields) {
    metadata[field.key] = text(supplied[field.key] ?? payload[field.key], 500);
  }
  return metadata;
}

function hasAccessToken(connection) {
  return Array.isArray(connection?.credentialBindings) &&
    connection.credentialBindings.some(
      (binding) => binding?.role === "access_token" && Boolean(binding?.credential)
    );
}

function missingFields(connection, definition) {
  return definition.fields
    .filter((field) => !text(connection?.metadata?.[field.key], 500))
    .map((field) => field.key);
}

function serialiseAccount(definition, connection = null) {
  const missing = connection ? missingFields(connection, definition) : definition.fields.map((field) => field.key);
  const credentialStored = hasAccessToken(connection);
  const disconnected = connection?.status === "disconnected" || connection?.status === "revoked";
  const ready = Boolean(connection) && !disconnected && credentialStored && missing.length === 0;

  let readiness = "not_connected";
  if (connection) {
    if (disconnected) readiness = "disconnected";
    else if (ready) readiness = "connected";
    else readiness = "needs_attention";
  }

  const metadata = {
    displayName: text(connection?.metadata?.displayName, 180),
  };
  for (const field of definition.fields) {
    metadata[field.key] = text(connection?.metadata?.[field.key], 500);
  }

  return {
    provider: definition.key,
    label: definition.label,
    description: definition.description,
    fields: definition.fields.map((field) => ({ ...field })),
    connectionId: connection?._id || null,
    status: connection?.status || "disconnected",
    readiness,
    ready,
    credentialStored,
    missingFields: missing,
    tokenExpiresAt: connection?.tokenExpiresAt || null,
    connectedAt: connection?.connectedAt || null,
    disconnectedAt: connection?.disconnectedAt || null,
    metadata,
  };
}

async function socialAccountsApp(businessId, ownerUser = null, { create = false } = {}) {
  objectId(businessId, "business");
  let app = await IntegrationApp.findOne({
    business: businessId,
    key: SOCIAL_ACCOUNTS_APP_KEY,
  });

  if (!app && create) {
    app = await IntegrationApp.create({
      business: businessId,
      key: SOCIAL_ACCOUNTS_APP_KEY,
      name: "Connected social accounts",
      description: "Tenant-owned social account connections for governed publishing.",
      ownerUser: mongoose.isValidObjectId(ownerUser) ? ownerUser : null,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      status: "active",
      scopes: ["campaigns:read", "campaigns:write"],
      metadata: {
        managedBy: "connected_accounts_ui",
        livePublishingEnabled: false,
      },
    });
  }

  if (app && app.status !== "active" && create) {
    if (app.status === "revoked") {
      throw createServiceError(
        "The connected-accounts integration has been revoked and cannot be changed.",
        409,
        { code: "CONNECTED_ACCOUNTS_APP_REVOKED" }
      );
    }
    app.status = "active";
    await app.save();
  }

  return app;
}

export async function listSocialConnectedAccounts({ businessId } = {}) {
  const app = await socialAccountsApp(businessId);
  const connections = app
    ? await IntegrationConnection.find({
        business: businessId,
        app: app._id,
        provider: { $in: Object.keys(PROVIDERS) },
      }).lean()
    : [];
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

  return {
    livePublishingEnabled: text(process.env.SOCIAL_PUBLISHING_LIVE_ENABLED, 20).toLowerCase() === "true",
    messagingIntegrationsOnHold: true,
    items: Object.values(PROVIDERS).map((definition) =>
      serialiseAccount(definition, byProvider.get(definition.key) || null)
    ),
  };
}

export async function connectSocialAccount(
  provider,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const definition = providerDefinition(provider);
  const app = await socialAccountsApp(businessId, actorUser, { create: true });
  const metadata = accountMetadata(definition, payload);
  const missing = definition.fields.filter((field) => !metadata[field.key]);
  if (missing.length) {
    throw createServiceError(
      `Required account details are missing: ${missing.map((field) => field.label).join(", ")}.`,
      400,
      {
        code: "CONNECTED_ACCOUNT_METADATA_REQUIRED",
        missingFields: missing.map((field) => field.key),
      }
    );
  }

  let connection = await IntegrationConnection.findOne({
    business: businessId,
    app: app._id,
    provider: definition.key,
    connectionKey: definition.key,
  });

  if (!connection) {
    connection = await IntegrationConnection.create({
      business: businessId,
      app: app._id,
      provider: definition.key,
      connectionKey: definition.key,
      status: "pending",
      metadata,
      externalAccountReferenceHash: hashReference(
        metadata[definition.fields[0]?.key]
      ),
    });
  } else {
    if (connection.status === "revoked") {
      throw createServiceError(
        `${definition.label} connection has been revoked and cannot be re-used.`,
        409,
        { code: "CONNECTED_ACCOUNT_REVOKED" }
      );
    }
    connection.metadata = metadata;
    connection.externalAccountReferenceHash = hashReference(
      metadata[definition.fields[0]?.key]
    );
    if (connection.status === "disconnected") {
      connection.status = "pending";
      connection.disconnectedAt = null;
    }
    await connection.save();
  }

  const accessToken = text(payload.accessToken, 20000);
  if (accessToken) {
    await storeProviderCredential(
      app._id,
      connection._id,
      {
        role: "access_token",
        secret: accessToken,
        expiresAt: payload.tokenExpiresAt || null,
        metadata: {
          source: "connected_accounts_ui",
        },
      },
      { businessId }
    );
  }

  connection = await IntegrationConnection.findOne({
    _id: connection._id,
    business: businessId,
    app: app._id,
  });

  if (!hasAccessToken(connection)) {
    connection.status = "pending";
    await connection.save();
    throw createServiceError(
      `${definition.label} requires an access token before it can be connected.`,
      400,
      { field: "accessToken", code: "CONNECTED_ACCOUNT_ACCESS_TOKEN_REQUIRED" }
    );
  }

  connection.status = "connected";
  connection.connectedAt = connection.connectedAt || new Date();
  connection.disconnectedAt = null;
  if (payload.tokenExpiresAt !== undefined) {
    connection.tokenExpiresAt = date(payload.tokenExpiresAt, "tokenExpiresAt");
  }
  await connection.save();

  return serialiseAccount(definition, connection);
}

export async function disconnectSocialAccount(
  provider,
  { businessId } = {}
) {
  const definition = providerDefinition(provider);
  const app = await socialAccountsApp(businessId);
  if (!app) {
    throw createServiceError(`${definition.label} is not connected.`, 404);
  }

  const connection = await IntegrationConnection.findOne({
    business: businessId,
    app: app._id,
    provider: definition.key,
    connectionKey: definition.key,
  });
  if (!connection) {
    throw createServiceError(`${definition.label} is not connected.`, 404);
  }

  const credentialIds = (connection.credentialBindings || [])
    .map((binding) => binding.credential)
    .filter(Boolean);
  const now = new Date();
  if (credentialIds.length) {
    await CredentialVersion.updateMany(
      {
        _id: { $in: credentialIds },
        business: businessId,
        app: app._id,
      },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          expiresAt: now,
        },
      }
    );
  }

  connection.credentialBindings = [];
  connection.status = "disconnected";
  connection.disconnectedAt = now;
  connection.tokenExpiresAt = null;
  await connection.save();

  return serialiseAccount(definition, connection);
}

export function socialConnectedAccountCatalogue() {
  return Object.values(PROVIDERS).map((definition) => ({
    provider: definition.key,
    label: definition.label,
    description: definition.description,
    fields: definition.fields.map((field) => ({ ...field })),
  }));
}

export default {
  connectSocialAccount,
  disconnectSocialAccount,
  listSocialConnectedAccounts,
  socialConnectedAccountCatalogue,
};
