import { createServiceError } from "../../shared/serviceError.js";
import * as service from "./marketingConnectedAccountsService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) throw createServiceError("A trusted active business is required for marketing connections.", 400);
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
  response.json(await service.configureMarketingConnectedAccount(
    request.params.provider,
    body(request),
    { businessId: businessId(request), actorUser: actorUser(request) }
  ));
}

export async function disconnect(request, response) {
  response.json(await service.disconnectMarketingConnectedAccount(
    request.params.provider,
    { businessId: businessId(request) }
  ));
}

export default { accounts, catalogue, configure, disconnect };
