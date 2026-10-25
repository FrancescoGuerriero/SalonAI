import { createServiceError } from "../../shared/serviceError.js";
import * as service from "./marketingConnectedAccountsService.js";
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

export async function catalogue(_request, response) {
  response.json(service.marketingConnectedAccountCatalogue());
}

export async function accounts(request, response) {
  response.json(await service.listMarketingConnectedAccounts({ businessId: businessId(request) }));
}

export async function configure(request, response) {
  const tenantBusinessId = businessId(request);
  const selectedLocationId = locationId(request);
  const actor = actorUser(request);
  const account = await service.configureMarketingConnectedAccount(
    request.params.provider,
    body(request),
    { businessId: tenantBusinessId, actorUser: actor }
  );
  let source = null;
  if (account.ready && account.connectionId) {
    source = await ensureMarketingSourceForConnection(account.provider, account.connectionId, {
      businessId: tenantBusinessId,
      locationId: selectedLocationId,
      actor,
    });
  }
  response.json({
    ...account,
    locationId: selectedLocationId,
    dataHubSourceId: source?._id || null,
    liveSyncEnabled: false,
  });
}

export async function disconnect(request, response) {
  const tenantBusinessId = businessId(request);
  const actor = actorUser(request);
  const account = await service.disconnectMarketingConnectedAccount(
    request.params.provider,
    { businessId: tenantBusinessId }
  );
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

export default { accounts, catalogue, configure, disconnect };
