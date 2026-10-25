import { createHash } from "node:crypto";

import AiGatewayInvocation from "../../models/AiGatewayInvocation.js";
import { createServiceError } from "../../shared/serviceError.js";
import { buildDataHubAiEvidence } from "./dataHubService.js";

const AI_GATEWAY_EVIDENCE_CONTRACT = "data_hub_evidence_v1";
const AI_GATEWAY_FACT_LIMIT = 500;
const AI_GATEWAY_PROVENANCE_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 10000;

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function safeDimensions(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [text(key, 80), text(item, 240)])
  );
}

function fact(name, value, { unit = null, dimensions = {} } = {}) {
  return {
    name: text(name, 120),
    value: value ?? null,
    unit: unit ? text(unit, 40) : null,
    dimensions: safeDimensions(dimensions),
  };
}

function appendFact(target, value) {
  if (target.length >= AI_GATEWAY_FACT_LIMIT) return;
  target.push(value);
}

function gatewayFacts(evidence) {
  const facts = [];
  const totals = evidence?.facts?.totals || {};
  for (const [name, value] of Object.entries(totals.metrics || {})) {
    appendFact(facts, fact(`total.${name}`, value, { dimensions: { scope: "query_total" } }));
  }
  for (const [name, value] of Object.entries(totals.calculated || {})) {
    appendFact(facts, fact(`total.${name}`, value, { dimensions: { scope: "query_total" } }));
  }
  appendFact(facts, fact("total.recordCount", totals.recordCount || 0, { dimensions: { scope: "query_total" } }));

  for (const row of evidence?.facts?.rows || []) {
    if (facts.length >= AI_GATEWAY_FACT_LIMIT) break;
    const dimensions = {
      ...(row.dateBucket ? { dateBucket: row.dateBucket } : {}),
      ...(row.dimensions || {}),
    };
    for (const [name, value] of Object.entries(row.metrics || {})) {
      appendFact(facts, fact(name, value, { dimensions }));
    }
    for (const [name, value] of Object.entries(row.calculated || {})) {
      appendFact(facts, fact(name, value, { dimensions }));
    }
  }
  return facts;
}

function gatewayProvenance(evidence) {
  const generatedAt = evidence?.provenance?.generatedAt || evidence?.generatedAt || new Date();
  const sources = Array.isArray(evidence?.provenance?.sources) ? evidence.provenance.sources : [];
  const items = sources.slice(0, AI_GATEWAY_PROVENANCE_LIMIT).map((source) => ({
    source_type: "marketing_data_source",
    source_id: text(source.id, 240),
    provider: text(source.provider, 80) || null,
    generated_at: generatedAt,
  }));
  if (!items.length) {
    items.push({
      source_type: "data_hub_query",
      source_id: "canonical-empty-source-set",
      provider: "canonical",
      generated_at: generatedAt,
    });
  }
  return items;
}

export async function buildGatewayEvidence(payload = {}, { businessId, locationId, now = new Date() } = {}) {
  const evidence = await buildDataHubAiEvidence(payload, { businessId, locationId, now });
  const facts = gatewayFacts(evidence);
  if (!facts.length) appendFact(facts, fact("total.recordCount", 0, { dimensions: { scope: "query_total" } }));
  const provenance = gatewayProvenance(evidence);
  const fingerprintInput = JSON.stringify({
    businessId: String(businessId),
    locationId: String(locationId),
    generatedAt: evidence.generatedAt,
    contractVersion: evidence.contractVersion,
    facts,
    provenance,
  });
  return {
    contract: AI_GATEWAY_EVIDENCE_CONTRACT,
    business_id: String(businessId),
    location_id: String(locationId),
    evidence_id: createHash("sha256").update(fingerprintInput).digest("hex"),
    generated_at: evidence.generatedAt,
    facts,
    provenance,
    metadata: {
      sourceContract: evidence.contract,
      sourceContractVersion: evidence.contractVersion,
      locationOwned: true,
      deterministic: Boolean(evidence?.provenance?.deterministic),
      recordsMatched: Number(evidence?.provenance?.recordsMatched || 0),
      truncatedScan: Boolean(evidence?.provenance?.truncatedScan),
      businessWideAggregationAuthorised: false,
      modelMayRecalculateCanonicalMetrics: false,
    },
  };
}

function gatewayConfiguration() {
  const baseUrl = text(process.env.AI_SERVICE_BASE_URL || process.env.AI_SERVICE_URL, 2000).replace(/\/$/, "");
  const serviceKey = text(process.env.AI_SERVICE_SERVICE_KEY || process.env.AI_SERVICE_KEY, 20000);
  if (!baseUrl || !serviceKey) {
    throw createServiceError("AI Gateway is not configured for this environment.", 503, {
      code: "AI_GATEWAY_NOT_CONFIGURED",
    });
  }
  const parsed = new URL(baseUrl);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw createServiceError("AI Gateway base URL is invalid.", 500, { code: "AI_GATEWAY_URL_INVALID" });
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw createServiceError("Production AI Gateway requires HTTPS.", 500, { code: "AI_GATEWAY_HTTPS_REQUIRED" });
  }
  return { baseUrl, serviceKey };
}

function requestedAction(payload = {}) {
  return ["analyse", "summarise", "forecast", "recommend"].includes(payload.requestedAction)
    ? payload.requestedAction
    : "analyse";
}

function invocationOutcome(plan = {}, status = "planned", errorCode = "") {
  const items = Array.isArray(plan.items) ? plan.items : [];
  return {
    status,
    ...(errorCode ? { errorCode: text(errorCode, 120) } : {}),
    registryVersion: text(plan.registry_version || plan.registryVersion, 40),
    advisoryVersion: text(plan.advisory_version || plan.advisoryVersion, 120),
    toolKey: text(plan.tool_key || plan.toolKey, 120),
    requestedAction: text(plan.requested_action || plan.requestedAction, 40),
    recommendationCount: items.filter((item) => item?.category === "recommendation").length,
    deterministicBaseline: Boolean(plan.deterministic_baseline || plan.deterministicBaseline),
    modelInferenceExecuted: false,
    humanApprovalRequired: plan.human_approval_required !== false && plan.humanApprovalRequired !== false,
    executionAuthorised: false,
    externalWriteAuthorised: false,
  };
}

async function recordInvocation({
  businessId,
  locationId,
  actor,
  toolKey,
  requestedAction: action,
  evidence,
  plan = {},
  status = "planned",
  errorCode = "",
}) {
  const evidenceChecksum = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  const sourceSummary = (evidence.provenance || []).slice(0, AI_GATEWAY_PROVENANCE_LIMIT).map((item) => ({
    sourceId: text(item.source_id, 240),
    provider: text(item.provider, 80),
  }));
  const outcome = invocationOutcome(plan, status, errorCode);
  return AiGatewayInvocation.create({
    business: businessId,
    location: locationId,
    toolKey,
    requestedAction: action,
    registryVersion: outcome.registryVersion,
    evidenceId: evidence.evidence_id,
    evidenceContract: evidence.contract,
    evidenceChecksum,
    factCount: evidence.facts.length,
    provenanceCount: evidence.provenance.length,
    sourceSummary,
    status,
    planOutcome: outcome,
    humanApprovalRequired: true,
    executionAuthorised: false,
    externalWriteAuthorised: false,
    inferenceExecuted: false,
    requestedBy: actorId(actor),
  });
}

async function gatewayPost(path, payload, { baseUrl, serviceKey }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-SalonAI-Service-Key": serviceKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: text(raw, 2000) }; }
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function planDataHubAiGateway(payload = {}, { businessId, locationId, actor = null, now = new Date() } = {}) {
  const evidence = await buildGatewayEvidence(payload, { businessId, locationId, now });
  const toolKey = text(payload.toolKey || "marketing-insights", 120) || "marketing-insights";
  const action = requestedAction(payload);
  const config = gatewayConfiguration();
  try {
    const { response, body } = await gatewayPost("/api/v1/ai-gateway/plan", {
      tool_key: toolKey,
      requested_action: action,
      evidence,
    }, config);
    if (!response.ok) {
      await recordInvocation({ businessId, locationId, actor, toolKey, requestedAction: action, evidence, plan: body, status: "rejected", errorCode: "AI_GATEWAY_PLAN_FAILED" });
      throw createServiceError(`AI Gateway planning returned HTTP ${response.status}.`, response.status, {
        code: "AI_GATEWAY_PLAN_FAILED",
        gatewayResponse: body,
      });
    }
    const invocation = await recordInvocation({
      businessId,
      locationId,
      actor,
      toolKey,
      requestedAction: action,
      evidence,
      plan: body,
      status: "planned",
    });
    return {
      locationId,
      evidence,
      plan: body,
      invocationId: invocation._id,
      inferenceExecuted: false,
      externalWriteAuthorised: false,
      message: "Canonical location-owned Data Hub evidence was accepted for gateway planning only. The planning event was audited. No inference or external write was executed by this endpoint.",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      await recordInvocation({ businessId, locationId, actor, toolKey, requestedAction: action, evidence, status: "failed", errorCode: "AI_GATEWAY_TIMEOUT" });
      throw createServiceError("AI Gateway planning timed out.", 504, { code: "AI_GATEWAY_TIMEOUT" });
    }
    throw error;
  }
}

export async function previewDataHubAiAdvisory(payload = {}, { businessId, locationId, actor = null, now = new Date() } = {}) {
  const evidence = await buildGatewayEvidence(payload, { businessId, locationId, now });
  const toolKey = text(payload.toolKey || "marketing-insights", 120) || "marketing-insights";
  const action = requestedAction(payload);
  const config = gatewayConfiguration();
  try {
    const { response, body } = await gatewayPost("/api/v1/ai-gateway/advisory-preview", {
      tool_key: toolKey,
      requested_action: action,
      evidence,
    }, config);
    if (!response.ok) {
      await recordInvocation({ businessId, locationId, actor, toolKey, requestedAction: action, evidence, plan: body, status: "rejected", errorCode: "AI_ADVISORY_PREVIEW_FAILED" });
      throw createServiceError(`AI advisory preview returned HTTP ${response.status}.`, response.status, {
        code: body?.code || body?.detail?.code || "AI_ADVISORY_PREVIEW_FAILED",
        gatewayResponse: body,
      });
    }
    const invocation = await recordInvocation({
      businessId,
      locationId,
      actor,
      toolKey,
      requestedAction: action,
      evidence,
      plan: body,
      status: "advisory_previewed",
    });
    return {
      locationId,
      evidence,
      advisory: body,
      invocationId: invocation._id,
      deterministicBaseline: true,
      modelInferenceExecuted: false,
      inferenceExecuted: false,
      executionAuthorised: false,
      externalWriteAuthorised: false,
      humanApprovalRequired: true,
      message: "A cited deterministic advisory preview was generated from canonical location-owned evidence. No model inference or external action occurred.",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      await recordInvocation({ businessId, locationId, actor, toolKey, requestedAction: action, evidence, status: "failed", errorCode: "AI_ADVISORY_TIMEOUT" });
      throw createServiceError("AI advisory preview timed out.", 504, { code: "AI_ADVISORY_TIMEOUT" });
    }
    throw error;
  }
}

export async function listAiGatewayInvocations(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (query.toolKey) match.toolKey = text(query.toolKey, 120);
  if (["planned", "advisory_previewed", "rejected", "failed"].includes(query.status)) match.status = query.status;
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return AiGatewayInvocation.find(match)
    .select("location toolKey requestedAction registryVersion evidenceId evidenceContract evidenceChecksum factCount provenanceCount sourceSummary status planOutcome humanApprovalRequired executionAuthorised externalWriteAuthorised inferenceExecuted requestedBy createdAt updatedAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export const AI_GATEWAY_BRIDGE_LIMITS = Object.freeze({
  factLimit: AI_GATEWAY_FACT_LIMIT,
  provenanceLimit: AI_GATEWAY_PROVENANCE_LIMIT,
});

export default {
  buildGatewayEvidence,
  listAiGatewayInvocations,
  planDataHubAiGateway,
  previewDataHubAiAdvisory,
};
