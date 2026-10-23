import * as service from "./dynamicPricingService.js";
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
      "Trusted tenant authority is required for pricing research.",
      403,
      { code: "PRICING_RESEARCH_TENANT_AUTHORITY_REQUIRED" }
    );
  }
  return {
    businessId,
    locationId:
      request.effectiveAuthority?.locationId ||
      request.tenantContext?.locationId ||
      null,
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

export async function recommendations(request, response) {
  const analytics = await service.generateDynamicPricingRecommendations(
    request.query || {},
    context(request)
  );
  return response.status(200).json({ success: true, analytics });
}

export async function rules(request, response) {
  return response.status(200).json({
    success: true,
    items: await service.listPriceRules(request.query || {}, context(request)),
  });
}

export async function createRule(request, response) {
  return response.status(201).json({
    success: true,
    rule: await service.createPriceRule(body(request), context(request)),
    deployment: {
      allowed: false,
      reason: "PriceRule research does not change canonical Service pricing.",
    },
  });
}

export async function reviewRule(request, response) {
  return response.status(200).json({
    success: true,
    rule: await service.reviewPriceRule(
      request.params.ruleId,
      body(request),
      context(request)
    ),
    deployment: {
      allowed: false,
      reason: "Approval is for simulation experiments only.",
    },
  });
}

export async function experiments(request, response) {
  return response.status(200).json({
    success: true,
    items: await service.listPricingExperiments(
      request.query || {},
      context(request)
    ),
  });
}

export async function createExperiment(request, response) {
  return response.status(201).json({
    success: true,
    experiment: await service.createPricingExperiment(
      body(request),
      context(request)
    ),
  });
}

export async function runExperiment(request, response) {
  return response.status(200).json({
    success: true,
    experiment: await service.runPricingExperiment(
      request.params.experimentId,
      context(request)
    ),
    deployment: {
      allowed: false,
      message:
        "Simulation completed. No production price was changed and no causal uplift claim is implied.",
    },
  });
}

export default {
  createExperiment,
  createRule,
  experiments,
  recommendations,
  reviewRule,
  rules,
  runExperiment,
};
