import * as service from "./benchmarkService.js";
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
      "Trusted tenant authority is required for benchmark operations.",
      403,
      { code: "BENCHMARK_TENANT_AUTHORITY_REQUIRED" }
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

export async function participation(request, response) {
  response.json({
    success: true,
    ...(await service.getBenchmarkParticipation(context(request))),
  });
}

export async function recordParticipation(request, response) {
  response.status(201).json({
    success: true,
    participation: await service.recordBenchmarkParticipation(
      body(request),
      context(request)
    ),
    rawDataPooled: false,
    modelTrainingUse: false,
  });
}

export async function refreshContribution(request, response) {
  response.status(201).json({
    success: true,
    contribution: await service.refreshBenchmarkContribution(
      body(request),
      context(request)
    ),
    crossTenantExposure: false,
  });
}

export async function ownContribution(request, response) {
  response.json({
    success: true,
    contribution: await service.getOwnBenchmarkContribution(
      request.query || {},
      context(request)
    ),
  });
}

export async function cohort(request, response) {
  response.json({
    success: true,
    cohort: await service.getBenchmarkCohort(
      request.query || {},
      context(request)
    ),
    rawTenantContributionsReturned: false,
  });
}

export default {
  cohort,
  ownContribution,
  participation,
  recordParticipation,
  refreshContribution,
};
