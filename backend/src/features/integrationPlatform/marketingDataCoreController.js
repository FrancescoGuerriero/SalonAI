import { createServiceError } from "../../shared/serviceError.js";
import * as service from "./marketingDataCoreService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) {
    throw createServiceError("A trusted active business is required for marketing data operations.", 400);
  }
  return value;
}

function actor(request) {
  return request.user || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function catalogue(_request, response) {
  response.json(service.marketingDataConnectorCatalogue());
}

export async function overview(request, response) {
  response.json(await service.marketingDataOverview({ businessId: businessId(request) }));
}

export async function sources(request, response) {
  response.json({ items: await service.listMarketingDataSources(request.query || {}, { businessId: businessId(request) }) });
}

export async function createSource(request, response) {
  response.status(201).json(await service.createMarketingDataSource(body(request), {
    businessId: businessId(request),
    actor: actor(request),
  }));
}

export async function updateSource(request, response) {
  response.json(await service.updateMarketingDataSource(request.params.sourceId, body(request), {
    businessId: businessId(request),
    actor: actor(request),
  }));
}

export async function preview(request, response) {
  response.json(await service.previewMarketingData(request.params.sourceId, body(request), {
    businessId: businessId(request),
  }));
}

export async function runSource(request, response) {
  response.status(201).json(await service.runMarketingDataSource(request.params.sourceId, body(request), {
    businessId: businessId(request),
    actor: actor(request),
  }));
}

export async function runs(request, response) {
  response.json({ items: await service.listMarketingSyncRuns(request.query || {}, { businessId: businessId(request) }) });
}

export async function seoObservations(request, response) {
  response.json({ items: await service.listSeoObservations(request.query || {}, { businessId: businessId(request) }) });
}

export default {
  catalogue,
  createSource,
  overview,
  preview,
  runSource,
  runs,
  seoObservations,
  sources,
  updateSource,
};
