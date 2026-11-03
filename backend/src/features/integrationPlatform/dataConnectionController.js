import mongoose from "mongoose";

import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential, storeProviderCredential } from "./providerCredentialService.js";
import { runDataConnectionBackfill } from "./dataConnectionBackfillService.js";
import {
  dataConnectionRuntimeConfig,
  generateDataConnectionAuthorization,
  getDataConnectionFields,
  listDataConnectionAvailability,
  listLinkedDataAccounts,
  previewDataConnection,
  unlinkLinkedDataAccount,
} from "./dataConnectionGatewayService.js";
import { dataConnection } from "./dataConnectionCatalogue.js";
import { importDataConnectionAccountToDataHub } from "./dataConnectionDataHubService.js";
import { listDataConnectionFieldProfiles, resolveDataConnectionFieldProfile } from "./dataConnectionFieldProfiles.js";
import { reserveDataConnectionApiRequest } from "./dataConnectionRateBudgetService.js";
import { sellerKpiSummary } from "./sellerKpiService.js";

const APP_KEY = "aiibp-managed-data-connections";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) {
    throw createServiceError("A trusted active business is required for managed data connections.", 400, {
      code: "BUSINESS_CONTEXT_REQUIRED",
    });
  }
  return String(value);
}

function locationId(request, { required = false } = {}) {
  const value = String(request.effectiveAuthority?.locationId || request.tenantContext?.locationId || "");
  if (required && !value) {
    throw createServiceError("Select a location before using Data Hub operations.", 400, {
      code: "LOCATION_REQUIRED",
    });
  }
  return value;
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

function productKey(request) {
  const value = String(request.params.connector || "").trim().toLowerCase();
  const entry = dataConnection(value);
  if (!entry) {
    throw createServiceError("Unknown AIIBP data connection.", 404, {
      code: "DATA_CONNECTION_NOT_IN_CATALOGUE",
    });
  }
  return { value, entry };
}

function connectionProvider(key) {
  return `managed_${String(key).trim().toLowerCase()}`.slice(0, 100);
}

function environment() {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "staging") return "staging";
  return "development";
}

async function appForBusiness(tenantBusinessId, owner = null, { create = false } = {}) {
  if (!mongoose.isValidObjectId(tenantBusinessId)) {
    throw createServiceError("Business identifier is invalid.", 400);
  }
  let app = await IntegrationApp.findOne({ business: tenantBusinessId, key: APP_KEY });
  if (!app && create) {
    app = await IntegrationApp.create({
      business: tenantBusinessId,
      key: APP_KEY,
      name: "AIIBP managed data connections",
      description: "Business-owned source authorization mappings for the AIIBP Integration Hub and Marketing module.",
      ownerUser: mongoose.isValidObjectId(owner) ? owner : null,
      environment: environment(),
      status: "active",
      scopes: ["marketing-data:read"],
      metadata: { managedBy: "aiibp_data_connections_ui", readOnlyByDefault: true },
    });
  }
  if (app?.status === "revoked") {
    throw createServiceError("AIIBP managed data connections have been revoked for this business.", 409);
  }
  return app;
}

async function connectionForBusiness(tenantBusinessId, key, { required = true } = {}) {
  const app = await appForBusiness(tenantBusinessId);
  if (!app) {
    if (required) throw createServiceError("Data connection has not been authorised for this business.", 404);
    return { app: null, connection: null };
  }
  const connection = await IntegrationConnection.findOne({
    business: tenantBusinessId,
    app: app._id,
    provider: connectionProvider(key),
    connectionKey: key,
  });
  if (!connection && required) {
    throw createServiceError("Data connection has not been authorised for this business.", 404);
  }
  return { app, connection };
}

function serialiseConnection(entry, connection = null) {
  const metadata = connection?.metadata || {};
  const accountIds = Array.isArray(metadata.accountIds) ? metadata.accountIds.map(String) : [];
  return {
    provider: entry.key,
    label: entry.label,
    category: entry.category,
    kind: entry.kind,
    connectionMode: "managed",
    status: connection?.status || "disconnected",
    connected: connection?.status === "connected" && accountIds.length > 0,
    connectorId: metadata.connectorId || "",
    authType: metadata.authType || "",
    accountCount: accountIds.length,
    accounts: Array.isArray(metadata.accounts)
      ? metadata.accounts.map((account) => ({
          accountId: String(account.accountId || ""),
          accountName: String(account.accountName || ""),
        }))
      : [],
    authorisedAt: metadata.authorisedAt || null,
    reconciledAt: metadata.reconciledAt || null,
    locationId: metadata.locationId || null,
  };
}

function serialiseSource(source) {
  return {
    sourceId: String(source._id),
    productKey: String(source.sourceConfig?.dataConnectionProductKey || ""),
    accountId: String(source.sourceConfig?.dataConnectionAccountId || ""),
    name: source.name,
    status: source.status,
    profileKey: source.sourceConfig?.profileKey || "custom",
    profileLabel: source.sourceConfig?.profileLabel || "Custom fields",
    cadence: source.schedule?.cadence || "manual",
    nextRunAt: source.schedule?.nextRunAt || null,
    lastSyncAt: source.lastSyncAt || null,
    lastSuccessAt: source.lastSuccessAt || null,
    lastError: source.lastError || "",
  };
}

async function accessTokenFor(connection) {
  if (!connection) throw createServiceError("Authorization session is unavailable.", 409);
  return (await resolveProviderCredential(connection, "access_token")).secret;
}

function assertOwnedAccount(connection, accountId) {
  const allowed = new Set((connection.metadata?.accountIds || []).map(String));
  if (!accountId || !allowed.has(accountId)) {
    throw createServiceError("That account is not connected to the active business.", 403, {
      code: "DATA_CONNECTION_ACCOUNT_NOT_OWNED_BY_BUSINESS",
    });
  }
  return (connection.metadata?.accounts || [])
    .find((account) => String(account.accountId) === accountId) || null;
}

async function assertOwnedSource(sourceId, tenantBusinessId, selectedLocationId, key) {
  if (!mongoose.isValidObjectId(sourceId)) {
    throw createServiceError("sourceId must be a valid identifier.", 400);
  }
  const source = await MarketingDataSource.findOne({
    _id: sourceId,
    business: tenantBusinessId,
    location: selectedLocationId,
    provider: "generic",
    "sourceConfig.managedBy": "aiibp_data_connections",
    "sourceConfig.dataConnectionProductKey": key,
  }).lean();
  if (!source) {
    throw createServiceError(
      "That Data Hub source does not belong to this Business, Location and connector.",
      403,
      { code: "DATA_CONNECTION_SOURCE_NOT_OWNED_BY_CONTEXT" }
    );
  }
  return source;
}

async function reconcileConnection(tenantBusinessId, key, entry) {
  const { connection } = await connectionForBusiness(tenantBusinessId, key);
  const connectorId = String(connection.metadata?.connectorId || key);
  const linked = await listLinkedDataAccounts({
    connectorId,
    accessToken: await accessTokenFor(connection),
  });
  const accounts = linked
    .filter((account) => account.datasource === connectorId)
    .map((account) => ({ accountId: account.accountId, accountName: account.accountName }));
  connection.metadata = {
    ...(connection.metadata?.toObject?.() || connection.metadata || {}),
    accountIds: accounts.map(({ accountId }) => accountId),
    accounts,
    reconciledAt: new Date(),
  };
  connection.status = accounts.length ? "connected" : "pending";
  connection.connectedAt = accounts.length ? (connection.connectedAt || new Date()) : connection.connectedAt;
  connection.lastSyncAt = new Date();
  await connection.save();
  return serialiseConnection(entry, connection);
}

export async function catalogue(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request);
  const availability = await listDataConnectionAvailability();
  const app = await appForBusiness(tenantBusinessId);
  const [connections, sources] = await Promise.all([
    app
      ? IntegrationConnection.find({
          business: tenantBusinessId,
          app: app._id,
          provider: { $regex: /^managed_/ },
        }).lean()
      : [],
    selectedLocationId && mongoose.isValidObjectId(selectedLocationId)
      ? MarketingDataSource.find({
          business: tenantBusinessId,
          location: selectedLocationId,
          provider: "generic",
          "sourceConfig.managedBy": "aiibp_data_connections",
        }).lean()
      : [],
  ]);
  const byKey = new Map(connections.map((connection) => [connection.connectionKey, connection]));
  response.json({
    version: "2.0.0",
    runtime: dataConnectionRuntimeConfig(),
    sources: sources.map(serialiseSource),
    items: availability.map((entry) => ({
      ...entry,
      profiles: listDataConnectionFieldProfiles(entry.key),
      connection: serialiseConnection(entry, byKey.get(entry.key) || null),
    })),
  });
}

export async function authorize(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request);
  const actor = actorUser(request);
  const { value: key, entry } = productKey(request);
  const app = await appForBusiness(tenantBusinessId, actor, { create: true });
  const auth = await generateDataConnectionAuthorization(key);

  let connection = await IntegrationConnection.findOne({
    business: tenantBusinessId,
    app: app._id,
    provider: connectionProvider(key),
    connectionKey: key,
  });
  if (!connection) {
    connection = await IntegrationConnection.create({
      business: tenantBusinessId,
      app: app._id,
      provider: connectionProvider(key),
      connectionKey: key,
      status: "pending",
      scopes: ["marketing-data:read"],
      metadata: {},
    });
  }

  connection.metadata = {
    ...(connection.metadata?.toObject?.() || connection.metadata || {}),
    productKey: key,
    connectorId: auth.connectorId,
    authType: auth.authType,
    authorizationSessionHash: auth.authorizationSessionHash,
    authorisedAt: new Date(),
    locationId: selectedLocationId || null,
    accountIds: [],
    accounts: [],
  };
  connection.status = "pending";
  connection.disconnectedAt = null;
  await connection.save();

  await storeProviderCredential(
    app._id,
    connection._id,
    {
      role: "access_token",
      secret: auth.authorizationAccessToken,
      metadata: {
        source: "aiibp_managed_authorization_link",
        provider: key,
        purpose: "account_reconciliation",
      },
    },
    { businessId: tenantBusinessId }
  );

  response.json({
    provider: key,
    label: entry.label,
    category: entry.category,
    kind: entry.kind,
    authType: auth.authType,
    fields: auth.fields,
    authorizationUrl: auth.authorizationUrl,
    connectionMode: "managed",
    note: "Authorization URLs may contain a temporary session token. Do not copy them into logs or support tickets.",
  });
}

export async function reconcile(request, response) {
  const tenantBusinessId = businessId(request);
  const { value: key, entry } = productKey(request);
  response.json(await reconcileConnection(tenantBusinessId, key, entry));
}

export async function fields(request, response) {
  const tenantBusinessId = businessId(request);
  const { value: key, entry } = productKey(request);
  const { connection } = await connectionForBusiness(tenantBusinessId, key);
  const connectorId = String(connection.metadata?.connectorId || key);
  response.json({
    provider: key,
    label: entry.label,
    connectorId,
    profiles: listDataConnectionFieldProfiles(key),
    fields: await getDataConnectionFields(connectorId),
  });
}

export async function profiles(request, response) {
  businessId(request);
  const { value: key, entry } = productKey(request);
  response.json({ provider: key, label: entry.label, profiles: listDataConnectionFieldProfiles(key) });
}

export async function preview(request, response) {
  const tenantBusinessId = businessId(request);
  const { value: key, entry } = productKey(request);
  const { connection } = await connectionForBusiness(tenantBusinessId, key);
  const payload = request.body && typeof request.body === "object" ? request.body : {};
  const accountId = String(payload.accountId || "").trim();
  assertOwnedAccount(connection, accountId);
  const profile = resolveDataConnectionFieldProfile(key, payload.profileKey || "");
  await reserveDataConnectionApiRequest();
  const data = await previewDataConnection({
    connectorId: String(connection.metadata?.connectorId || key),
    accountId,
    fields: payload.fields?.length ? payload.fields : profile?.fields,
    datePreset: payload.datePreset,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    limit: payload.limit,
  });
  connection.lastSyncAt = new Date();
  await connection.save();
  response.json({
    provider: key,
    label: entry.label,
    accountId,
    profile: profile ? { key: profile.key, label: profile.label } : null,
    preview: true,
    readOnly: true,
    data,
  });
}

export async function importToDataHub(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request, { required: true });
  const actor = actorUser(request);
  const { value: key, entry } = productKey(request);
  if (["destination", "ai-destination"].includes(entry.kind)) {
    throw createServiceError("Destinations cannot be imported as source data.", 409, {
      code: "DATA_CONNECTION_IS_DESTINATION",
    });
  }
  const { connection } = await connectionForBusiness(tenantBusinessId, key);
  const payload = request.body && typeof request.body === "object" ? request.body : {};
  const accountId = String(payload.accountId || "").trim();
  const account = assertOwnedAccount(connection, accountId);
  const result = await importDataConnectionAccountToDataHub({
    connection,
    connectorId: String(connection.metadata?.connectorId || key),
    productKey: key,
    productLabel: entry.label,
    accountId,
    accountName: account?.accountName || accountId,
    fields: payload.fields,
    profileKey: payload.profileKey || "",
    datePreset: payload.datePreset || "last_7d",
    limit: payload.limit || 100,
    syncCadence: payload.syncCadence || "manual",
    timezone: payload.timezone || "Europe/London",
    businessId: tenantBusinessId,
    locationId: selectedLocationId,
    actor,
  });
  response.json({ provider: key, label: entry.label, accountId, locationId: selectedLocationId, ...result });
}

export async function backfill(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request, { required: true });
  const actor = actorUser(request);
  const { value: key, entry } = productKey(request);
  const payload = request.body && typeof request.body === "object" ? request.body : {};
  const sourceId = String(payload.sourceId || "").trim();
  await assertOwnedSource(sourceId, tenantBusinessId, selectedLocationId, key);
  const result = await runDataConnectionBackfill(
    sourceId,
    {
      dateFrom: payload.dateFrom,
      dateTo: payload.dateTo,
      sliceDays: payload.sliceDays,
      actor,
    },
    { businessId: tenantBusinessId, locationId: selectedLocationId }
  );
  response.json({ provider: key, label: entry.label, locationId: selectedLocationId, ...result });
}

export async function sellerKpis(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request, { required: true });
  const { value: key, entry } = productKey(request);
  if (entry.kind !== "seller") {
    throw createServiceError("Seller KPI summaries are only available for seller connectors.", 409, {
      code: "DATA_CONNECTION_NOT_SELLER",
    });
  }
  const sourceId = String(request.query.sourceId || "").trim();
  await assertOwnedSource(sourceId, tenantBusinessId, selectedLocationId, key);
  response.json({
    provider: key,
    label: entry.label,
    ...(await sellerKpiSummary(
      sourceId,
      { profileKey: request.query.profile || "" },
      { businessId: tenantBusinessId, locationId: selectedLocationId }
    )),
  });
}

export async function unlinkAccount(request, response) {
  const tenantBusinessId = businessId(request);
  const { value: key, entry } = productKey(request);
  const accountId = String(request.params.accountId || "").trim();
  const { connection } = await connectionForBusiness(tenantBusinessId, key);
  assertOwnedAccount(connection, accountId);
  await unlinkLinkedDataAccount({
    connectorId: String(connection.metadata?.connectorId || key),
    accountId,
    accessToken: await accessTokenFor(connection),
  });
  response.json(await reconcileConnection(tenantBusinessId, key, entry));
}

export default {
  authorize,
  backfill,
  catalogue,
  fields,
  importToDataHub,
  preview,
  profiles,
  reconcile,
  sellerKpis,
  unlinkAccount,
};
