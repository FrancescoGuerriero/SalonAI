import { createServiceError } from "../../shared/serviceError.js";
import * as service from "./aiBaselineComparisonService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) throw createServiceError("A trusted active business is required for AI baseline comparison.", 400);
  return value;
}

function locationId(request) {
  const value = request.effectiveAuthority?.locationId || request.tenantContext?.locationId || null;
  if (!value) {
    throw createServiceError("Select a location before using AI baseline comparison.", 400, {
      code: "LOCATION_REQUIRED",
    });
  }
  return value;
}

function scope(request) {
  return { businessId: businessId(request), locationId: locationId(request) };
}

function actor(request) {
  return request.user || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function create(request, response) {
  response.status(201).json(await service.createBaselineComparison(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function list(request, response) {
  response.json({ items: await service.listBaselineComparisons(request.query || {}, scope(request)) });
}

export async function get(request, response) {
  response.json(await service.getBaselineComparison(request.params.comparisonId, scope(request)));
}

export default { create, list, get };
