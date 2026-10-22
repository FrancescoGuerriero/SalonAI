import * as service from "./workflowEngineService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for workflow operations.",
      400
    );
  }
  return value;
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function definitions(request, response) {
  response.json({
    items: await service.listWorkflowDefinitions(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function definition(request, response) {
  response.json(
    await service.getWorkflowDefinition(request.params.workflowId, {
      businessId: businessId(request),
    })
  );
}

export async function createDefinition(request, response) {
  response.status(201).json(
    await service.createWorkflowDefinition(body(request), {
      businessId: businessId(request),
    })
  );
}

export async function changeStatus(request, response) {
  response.json(
    await service.setWorkflowStatus(
      request.params.workflowId,
      body(request).status,
      { businessId: businessId(request) }
    )
  );
}

export async function runs(request, response) {
  response.json({
    items: await service.listWorkflowRuns(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function resumeRun(request, response) {
  response.json(
    await service.resumeWorkflowRun(request.params.runId, {
      businessId: businessId(request),
    })
  );
}

export async function processTick(request, response) {
  const payload = body(request);
  response.json(
    await service.processWorkflowTick({
      eventLimit: payload.eventLimit,
      runLimit: payload.runLimit,
    })
  );
}

export default {
  changeStatus,
  createDefinition,
  definition,
  definitions,
  processTick,
  resumeRun,
  runs,
};
