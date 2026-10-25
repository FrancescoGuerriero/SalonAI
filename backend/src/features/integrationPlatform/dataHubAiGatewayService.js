import { createHash } from "node:crypto";

import { createServiceError } from "../../shared/serviceError.js";
import { buildDataHubAiEvidence } from "./dataHubService.js";

const AI_GATEWAY_EVIDENCE_CONTRACT = "data_hub_evidence_v1";
const AI_GATEWAY_FACT_LIMIT = 500;
const AI_GATEWAY_PROVENANCE_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 10000;

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
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

export async function buildGatewayEvidence(payload = {}, { businessId, now = new Date() } = {}) {
  const evidence = await buildDataHubAiEvidence(payload, { businessId, now });
  const facts = gatewayFacts(evidence);
  if (!facts.length) appendFact(facts, fact("total.recordCount", 0, { dimensions: { scope: "query_total" } }));
  const provenance = gatewayProvenance(evidence);
  const fingerprintInput = JSON.stringify({
    businessId: String(businessId),
    generatedAt: evidence.generatedAt,
    contractVersion: evidence.contractVersion,
    facts,
    provenance,
  });
  return {
    contract: AI_GATEWAY_EVIDENCE_CONTRACT,
    business_id: String(businessId),
    evidence_id: createHash("sha256").update(fingerprintInput).digest("hex"),
    generated_at: evidence.generatedAt,
    facts,
    provenance,
    metadata: {
      sourceContract: evidence.contract,
      sourceContractVersion: evidence.contractVersion,
      deterministic: Boolean(evidence?.provenance?.deterministic),
      recordsMatched: Number(evidence?.provenance?.recordsMatched || 0),
      truncatedScan: Boolean(evidence?.provenance?.truncatedScan),
      modelMayRecalculateCanonicalMetrics: false,
    },
  };
}

function gatewayConfiguration() {
  const baseUrl = text(process.env.AI_SERVICE_BASE_URL || process.env.AI_SERVICE_URL, 2000).replace(/\/$/, "");
  const serviceKey = text(process.env.AI_SERVICE_SERVICE_KEY || process.env.AI_SERVICE_KEY, 20000);
  if (!baseUrl || !serviceKey) {
    throw createServiceError("AI Gateway planning is not configured for this environment.", 503, {
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

export async function planDataHubAiGateway(payload = {}, { businessId, now = new Date() } = {}) {
  const evidence = await buildGatewayEvidence(payload, { businessId, now });
  const toolKey = text(payload.toolKey || "marketing-insights", 120) || "marketing-insights";
  const requestedAction = ["analyse", "summarise", "forecast", "recommend"].includes(payload.requestedAction)
    ? payload.requestedAction
    : "analyse";
  const { baseUrl, serviceKey } = gatewayConfiguration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/v1/ai-gateway/plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-SalonAI-Service-Key": serviceKey,
      },
      body: JSON.stringify({
        tool_key: toolKey,
        requested_action: requestedAction,
        evidence,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: text(raw, 2000) }; }
    if (!response.ok) {
      throw createServiceError(`AI Gateway planning returned HTTP ${response.status}.`, response.status, {
        code: "AI_GATEWAY_PLAN_FAILED",
        gatewayResponse: body,
      });
    }
    return {
      evidence,
      plan: body,
      inferenceExecuted: false,
      externalWriteAuthorised: false,
      message: "Canonical Data Hub evidence was accepted for gateway planning only. No inference or external write was executed by this endpoint.",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createServiceError("AI Gateway planning timed out.", 504, { code: "AI_GATEWAY_TIMEOUT" });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const AI_GATEWAY_BRIDGE_LIMITS = Object.freeze({
  factLimit: AI_GATEWAY_FACT_LIMIT,
  provenanceLimit: AI_GATEWAY_PROVENANCE_LIMIT,
});

export default { buildGatewayEvidence, planDataHubAiGateway };
