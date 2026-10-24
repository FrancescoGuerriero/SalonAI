import { createServiceError } from "../../shared/serviceError.js";
import {
  connectSocialAccount,
  disconnectSocialAccount,
  listSocialConnectedAccounts,
} from "./socialConnectedAccountsService.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for connected-account operations.",
      400
    );
  }
  return value;
}

function actorId(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function connectedAccounts(request, response) {
  response.json(
    await listSocialConnectedAccounts({
      businessId: businessId(request),
    })
  );
}

export async function connectAccount(request, response) {
  response.json(
    await connectSocialAccount(
      request.params.provider,
      body(request),
      {
        businessId: businessId(request),
        actorUser: actorId(request),
      }
    )
  );
}

export async function disconnectAccount(request, response) {
  response.json(
    await disconnectSocialAccount(
      request.params.provider,
      {
        businessId: businessId(request),
      }
    )
  );
}

export default {
  connectedAccounts,
  connectAccount,
  disconnectAccount,
};
