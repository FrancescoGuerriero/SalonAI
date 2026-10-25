import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import * as legacyService from "./marketingConnectedAccountsService.js";
import {
  configureVerifiedMarketingConnector,
  disconnectVerifiedMarketingConnector,
  getVerifiedMarketingConnector,
  listVerifiedMarketingConnectors,
  verifiedMarketingConnectorCatalogue,
  verifiedMarketingConnectorDefinition,
} from "./marketingVerifiedConnectorsService.js";
import {
  marketingAccountVerifierAvailable,
  verifyMarketingConnectedAccount,
} from "./marketingAccountVerifierRegistryService.js";
import { marketingConnectorDefinition } from "./marketingConnectorCatalogue.js";
import {
  ensureMarketingSourceForConnection,
  pauseMarketingSourceForProvider,
} from "./marketingSourceProvisioningService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) throw createServiceError("A trusted active business is required for marketing connections.", 400);
  return value;
}

function locationId(request) {
  const value = request.effectiveAuthority?.locationId || request.tenantContext?.locationId || null;
  if (!value) {
    throw createServiceError(
      "Select a location before configuring location-owned marketing data.",
      400,
      { code: "LOCATION_REQUIRED" }
    );
  }
  return value;
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body : {};
}

function governedItem(item, connection = null) {
  const verifierAvailable = marketingAccountVerifierAvailable(item.provider);
  if (verifiedMarketingConnectorDefinition(item.provider)) return item;
  if (!item.configurable) return { ...item, verificationAvailable: false };
  if (!verifierAvailable) {
    return {
      ...item,
      configurable: false,
      ready: false,
      verified: false,
      verificationAvailable: false,
      implementationStatus: "verification_adapter_required",
      readiness: "verification_adapter_required",
    };
  }
  const verificationStatus = connection?.metadata?.verificationStatus || "required";
  const verified = connection?.status === "connected" && verificationStatus === "verified";
  return {
    ...item,
    status: connection?.status || item.status,
    connectedAt: connection?.connectedAt || item.connectedAt,
    configurable: true,
    ready: verified,
    verified,
    verifiedAt: connection?.metadata?.verifiedAt || null,
    verificationAvailable: true,
    readiness: verified
      ? "configured"
      : verificationStatus === "failed"
        ? "verification_failed"
        : connection
          ? "verification_required"
          : "not_connected",
    metadata: {
      ...(item.metadata || {}),
      verifiedAccount: connection?.metadata?.verifiedAccount || null,
    },
  };
}

function mergeByProvider(baseItems, overrideItems, connections = new Map()) {
  const byProvider = new Map(
    (baseItems || []).map((item) => [
      item.provider,
      governedItem(item, connections.get(item.provider) || null),
    ])
  );
  for (const item of overrideItems || []) byProvider.set(item.provider, item);
  return [...byProvider.values()];
}

function ingestionAdapterAvailable(provider) {
  try {
    return marketingConnectorDefinition(provider).liveActivation !== "catalogue_only";
  } catch {
    return false;
  }
}

export async function catalogue(_request, response) {
  const base = legacyService.marketingConnectedAccountCatalogue();
  response.json({
    ...base,
    version: "1.2.0",
    items: mergeByProvider(base.items, verifiedMarketingConnectorCatalogue()),
    message: "Only connectors with provider-specific credential contracts and live read-only account verification are connectable.",
  });
}

export async function accounts(request, response) {
  const tenantBusinessId = businessId(request);
  const [base, verified, rawConnections] = await Promise.all([
    legacyService.listMarketingConnectedAccounts({ businessId: tenantBusinessId }),
    listVerifiedMarketingConnectors({ businessId: tenantBusinessId }),
    IntegrationConnection.find({ business: tenantBusinessId }).select("provider status connectedAt metadata").lean(),
  ]);
  const connections = new Map(rawConnections.map((connection) => [connection.provider, connection]));
  response.json({
    ...base,
    version: "1.2.0",
    items: mergeByProvider(base.items, verified, connections),
    message: "A provider is Connected only after its credentials pass a real provider account verification request.",
  });
}

export async function configure(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request);
  const actor = actorUser(request);
  const provider = String(request.params.provider || "").trim().toLowerCase();

  if (!marketingAccountVerifierAvailable(provider)) {
    throw createServiceError(
      "This provider does not yet have a provider-specific live account verifier and cannot be configured.",
      409,
      { code: "MARKETING_PROVIDER_VERIFIER_NOT_AVAILABLE", provider }
    );
  }

  const verifiedDefinition = verifiedMarketingConnectorDefinition(provider);
  const stagedAccount = verifiedDefinition
    ? await configureVerifiedMarketingConnector(provider, body(request), {
        businessId: tenantBusinessId,
        actorUser: actor,
      })
    : await legacyService.configureMarketingConnectedAccount(provider, body(request), {
        businessId: tenantBusinessId,
        actorUser: actor,
      });

  if (!stagedAccount.connectionId) {
    throw createServiceError("Provider credentials were not persisted for verification.", 409);
  }

  const verification = await verifyMarketingConnectedAccount(provider, {
    businessId: tenantBusinessId,
  });

  const account = verifiedDefinition
    ? await getVerifiedMarketingConnector(provider, { businessId: tenantBusinessId })
    : (await legacyService.listMarketingConnectedAccounts({ businessId: tenantBusinessId })).items.find(
        (item) => item.provider === provider
      );

  const supportsIngestion = ingestionAdapterAvailable(provider);
  let source = null;
  if (verification.verified && account?.connectionId && supportsIngestion) {
    source = await ensureMarketingSourceForConnection(provider, account.connectionId, {
      businessId: tenantBusinessId,
      locationId: selectedLocationId,
      actor,
    });
  }

  response.json({
    ...account,
    configurable: true,
    ready: true,
    verified: true,
    verificationAvailable: true,
    readiness: "configured",
    verifiedAt: verification.verifiedAt,
    verification,
    locationId: selectedLocationId,
    ingestionAdapterAvailable: supportsIngestion,
    dataHubSourceStatus: supportsIngestion ? "ready_manual" : "account_connected_adapter_pending",
    dataHubSourceId: source?._id || null,
    liveSyncEnabled: false,
  });
}

export async function verify(request, response) {
  const tenantBusinessId = businessId(request);
  const provider = String(request.params.provider || "").trim().toLowerCase();
  const verification = await verifyMarketingConnectedAccount(provider, {
    businessId: tenantBusinessId,
  });
  response.json({
    ...verification,
    ingestionAdapterAvailable: ingestionAdapterAvailable(provider),
    liveSyncEnabled: false,
  });
}

export async function disconnect(request, response) {
  const tenantBusinessId = businessId(request);
  const actor = actorUser(request);
  const provider = String(request.params.provider || "").trim().toLowerCase();
  const account = verifiedMarketingConnectorDefinition(provider)
    ? await disconnectVerifiedMarketingConnector(provider, { businessId: tenantBusinessId })
    : await legacyService.disconnectMarketingConnectedAccount(provider, {
        businessId: tenantBusinessId,
      });
  const paused = await pauseMarketingSourceForProvider(account.provider, {
    businessId: tenantBusinessId,
    actor,
  });
  response.json({
    ...account,
    locationSourcesPaused: paused?.modifiedCount || 0,
    dataHubSourcePaused: true,
    liveSyncEnabled: false,
  });
}

export default { accounts, catalogue, configure, disconnect, verify };