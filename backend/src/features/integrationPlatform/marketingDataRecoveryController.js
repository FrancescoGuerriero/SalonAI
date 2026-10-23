import { createServiceError } from "../../shared/serviceError.js";
import { retryMarketingSyncRun } from "./marketingDataRecoveryService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) throw createServiceError("A trusted active business is required for marketing data operations.", 400);
  return value;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function retryRun(request, response) {
  response.status(201).json(await retryMarketingSyncRun(
    request.params.runId,
    body(request),
    { businessId: businessId(request), actor: request.user || null }
  ));
}

export default { retryRun };
