import * as service from "./enterpriseSsoService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function context(request) {
  const businessId =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!businessId) {
    throw createServiceError(
      "Trusted tenant authority is required for Enterprise SSO configuration.",
      403,
      { code: "ENTERPRISE_SSO_TENANT_AUTHORITY_REQUIRED" }
    );
  }
  return {
    businessId,
    user: request.user,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"] ||
      "",
  };
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function list(request, response) {
  return response.status(200).json({
    success: true,
    items: await service.listEnterpriseSsoConnections(context(request)),
  });
}

export async function create(request, response) {
  return response.status(201).json({
    success: true,
    connection: await service.createEnterpriseSsoConnection(
      body(request),
      context(request)
    ),
    runtime: {
      activationAllowed: false,
      message:
        "Federation runtime is not activated by configuration creation. Protocol runtime and provider acceptance remain separate gates.",
    },
  });
}

export async function update(request, response) {
  return response.status(200).json({
    success: true,
    connection: await service.updateEnterpriseSsoConnection(
      request.params.connectionId,
      body(request),
      context(request)
    ),
  });
}

export async function readiness(request, response) {
  return response.status(200).json({
    success: true,
    connection: await service.checkEnterpriseSsoReadiness(
      request.params.connectionId,
      context(request)
    ),
  });
}

export default {
  create,
  list,
  readiness,
  update,
};
