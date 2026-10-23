import * as service from "../aiPlatform/aiWorkforceGovernanceService.js";

function tenant(request) {
  return {
    businessId:
      request.effectiveAuthority?.businessId ||
      request.tenantContext?.businessId ||
      null,
    locationId:
      request.effectiveAuthority?.locationId ||
      request.tenantContext?.locationId ||
      null,
    effectiveAuthority: request.effectiveAuthority,
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

export async function registry(request, response) {
  response.json({
    success: true,
    ...(await service.getAiWorkforceRegistry(tenant(request))),
  });
}

export async function runs(request, response) {
  response.json({
    success: true,
    items: await service.listAiWorkforceRuns(
      request.query || {},
      tenant(request)
    ),
  });
}

export async function proposals(request, response) {
  response.json({
    success: true,
    items: await service.listAiWorkforceProposals(
      request.query || {},
      tenant(request)
    ),
  });
}

export async function outcomes(request, response) {
  response.json({
    success: true,
    items: await service.listAiActionOutcomes(
      request.query || {},
      tenant(request)
    ),
  });
}

export async function observeOutcome(request, response) {
  response.status(201).json({
    success: true,
    outcome: await service.observeAiActionOutcome(
      request.params.proposalId,
      body(request),
      tenant(request)
    ),
    execution: {
      automatic: false,
      message:
        "This records observed human/business outcome evidence only. It does not execute the AI proposal.",
    },
  });
}

export default {
  observeOutcome,
  outcomes,
  proposals,
  registry,
  runs,
};
