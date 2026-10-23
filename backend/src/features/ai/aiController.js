import * as aiService from "./aiService.js";
import * as tenantRetention from "./aiRetentionTenantService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function normaliseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalisedValue = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalisedValue)) return true;
  if (["false", "0", "no", "off"].includes(normalisedValue)) return false;
  return fallback;
}

function retentionContext(request) {
  const businessId =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!businessId) {
    throw createServiceError(
      "Trusted tenant authority is required for retention AI.",
      403,
      { code: "AI_RETENTION_TENANT_AUTHORITY_REQUIRED" }
    );
  }
  return { businessId };
}

export async function retention(request, response) {
  const force = normaliseBoolean(
    request.body?.force ?? request.query?.force,
    true
  );
  const result = await tenantRetention.predictTenantRetention(
    request.params.customerId,
    { force },
    retentionContext(request)
  );
  return response.status(200).json({ success: true, prediction: result });
}

export async function storedRetention(request, response) {
  const prediction = await tenantRetention.getTenantStoredRetentionPrediction(
    request.params.customerId,
    retentionContext(request)
  );
  if (!prediction) {
    const error = new Error(
      "No stored retention prediction was found for this customer."
    );
    error.statusCode = 404;
    error.status = 404;
    throw error;
  }
  return response.status(200).json({ success: true, prediction });
}

export async function retentionBatch(request, response) {
  const payload = {
    ...request.body,
    force: normaliseBoolean(request.body?.force, false),
  };
  const result = await tenantRetention.predictTenantRetentionBatch(
    payload,
    retentionContext(request)
  );
  return response.status(200).json({
    success: result.failed === 0,
    message: `${result.succeeded} customer retention prediction${
      result.succeeded === 1 ? "" : "s"
    } completed.`,
    ...result,
  });
}

export async function retentionPredictions(request, response) {
  const result = await tenantRetention.listTenantRetentionPredictions(
    request.query,
    retentionContext(request)
  );
  return response.status(200).json({ success: true, ...result });
}

export async function retentionSummary(request, response) {
  const summary = await tenantRetention.getTenantRetentionSummary(
    retentionContext(request)
  );
  return response.status(200).json({ success: true, summary });
}

export async function copy(request, response) {
  const result = await aiService.generateCampaignCopy(request.body || {});
  return response.status(200).json({ success: true, copy: result });
}

export async function forecast(request, response) {
  const result = await aiService.generateRevenueForecast(request.body || {});
  return response.status(201).json({ success: true, forecast: result });
}

export async function latestForecast(request, response) {
  const forecast = await aiService.latestForecast();
  if (!forecast) {
    return response.status(200).json({
      success: true,
      forecast: null,
      message: "No revenue forecast has been generated yet.",
    });
  }
  return response.status(200).json({ success: true, forecast });
}

export default {
  copy,
  forecast,
  latestForecast,
  retention,
  retentionBatch,
  retentionPredictions,
  retentionSummary,
  storedRetention,
};
