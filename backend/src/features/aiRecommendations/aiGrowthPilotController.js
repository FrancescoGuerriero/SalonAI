import * as service from "../aiPlatform/aiGrowthPilotService.js";

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

export async function retentionPilot(request, response) {
  response.status(201).json({
    success: true,
    ...(await service.runRetentionGrowthPilot(body(request), tenant(request))),
    execution: {
      automatic: false,
      message:
        "The Retention pilot can create a governed A1 workflow proposal only. It does not enrol the customer or send a communication automatically.",
    },
  });
}

export async function leadPilot(request, response) {
  response.status(201).json({
    success: true,
    ...(await service.runLeadGrowthPilot(
      request.params.leadId,
      body(request),
      tenant(request)
    )),
    execution: {
      automatic: false,
      message:
        "The Lead pilot can create a governed A1 nurture-workflow proposal only. It does not mutate the lead or send a communication automatically.",
    },
  });
}

export async function measurePilot(request, response) {
  response.status(201).json({
    success: true,
    outcome: await service.measureAiGrowthPilotProposal(
      request.params.proposalId,
      body(request),
      tenant(request)
    ),
    execution: {
      automatic: false,
      message:
        "This records conversion measurement against an approved, human-implemented pilot proposal. It does not execute the proposal.",
    },
  });
}

export default {
  leadPilot,
  measurePilot,
  retentionPilot,
};
