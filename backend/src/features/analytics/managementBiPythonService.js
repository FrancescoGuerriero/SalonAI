import crypto from "node:crypto";

import AiGatewayInvocation from "../../models/AiGatewayInvocation.js";
import { createServiceError } from "../../shared/serviceError.js";
import { buildManagementBiSnapshot, MANAGEMENT_EVIDENCE_CONTRACT } from "./managementBiService.js";

const DEFAULT_TIMEOUT_MS = 10000;
const TOOL_KEY = "management-copilot";
const REQUESTED_ACTION = "analyse";

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
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
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { message: text(raw, 2000) };
    }
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

function pythonEvidence(snapshot) {
  const locationId = text(snapshot?.authority?.selectedLocationId, 120);
  if (
    !locationId ||
    snapshot?.authority?.locationIds?.length !== 1 ||
    snapshot?.pythonAnalysis?.available !== true
  ) {
    throw createServiceError(
      "Governed Python management analysis requires one explicitly selected authorised Location.",
      409,
      { code: "POINT10_PYTHON_SINGLE_LOCATION_REQUIRED" }
    );
  }

  return {
    contract: MANAGEMENT_EVIDENCE_CONTRACT,
    business_id: text(snapshot.authority.businessId, 120),
    location_id: locationId,
    evidence_id: text(snapshot.evidence.evidenceId, 240),
    checksum: text(snapshot.evidence.checksum, 128),
    generated_at: snapshot.generatedAt,
    period_label: snapshot.period.label,
    metrics: snapshot.metrics.map((metric) => ({
      key: text(metric.key, 120),
      version: text(metric.version, 40),
      label: text(metric.label, 160),
      value: Number(metric.value || 0),
      previous_value: Number(metric.previous_value || 0),
      unit: text(metric.unit, 40),
      area: text(metric.area, 80),
    })),
  };
}

function assertIdentityEcho(body, evidence) {
  const expected = {
    business_id: evidence.business_id,
    location_id: evidence.location_id,
    evidence_id: evidence.evidence_id,
    checksum: evidence.checksum,
    tool_key: TOOL_KEY,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (text(body?.[key], 240) !== text(value, 240)) {
      throw createServiceError(
        `AI Gateway management analysis identity mismatch for ${key}.`,
        502,
        { code: "POINT10_AI_IDENTITY_MISMATCH" }
      );
    }
  }
  if (body?.model_inference_executed !== false || body?.execution_authorised !== false || body?.external_write_authorised !== false) {
    throw createServiceError(
      "AI Gateway management analysis violated the non-execution contract.",
      502,
      { code: "POINT10_AI_EXECUTION_CONTRACT_VIOLATION" }
    );
  }
}

async function recordInvocation({ snapshot, evidence, actor, responseBody = {}, status = "planned", errorCode = "" }) {
  const planOutcome = {
    status,
    ...(errorCode ? { errorCode: text(errorCode, 120) } : {}),
    registryVersion: text(responseBody.registry_version, 40),
    analysisVersion: text(responseBody.analysis_version, 120),
    toolKey: TOOL_KEY,
    requestedAction: REQUESTED_ACTION,
    observationCount: Array.isArray(responseBody.observations) ? responseBody.observations.length : 0,
    deterministicBaseline: responseBody.deterministic_baseline !== false,
    modelInferenceExecuted: false,
    humanApprovalRequired: true,
    executionAuthorised: false,
    externalWriteAuthorised: false,
  };

  return AiGatewayInvocation.create({
    business: snapshot.authority.businessId,
    location: evidence.location_id,
    toolKey: TOOL_KEY,
    requestedAction: REQUESTED_ACTION,
    registryVersion: planOutcome.registryVersion,
    evidenceId: evidence.evidence_id,
    evidenceContract: evidence.contract,
    evidenceChecksum: evidence.checksum,
    factCount: evidence.metrics.length,
    provenanceCount: snapshot.definitions?.length || 0,
    sourceSummary: [
      { sourceId: snapshot.evidence.metricCalculatorAuthority, provider: "canonical" },
      { sourceId: snapshot.evidence.metricDefinitionAuthority, provider: "canonical" },
    ],
    status,
    planOutcome,
    humanApprovalRequired: true,
    executionAuthorised: false,
    externalWriteAuthorised: false,
    inferenceExecuted: false,
    requestedBy: actorId(actor),
  });
}

export async function analyseManagementBiWithPython({
  effectiveAuthority = {},
  actor = null,
  periodDays = 30,
  asOfDate = new Date(),
} = {}) {
  const snapshot = await buildManagementBiSnapshot({ effectiveAuthority, periodDays, asOfDate });
  const evidence = pythonEvidence(snapshot);
  const config = gatewayConfiguration();

  try {
    const { response, body } = await gatewayPost(
      "/api/v1/ai-gateway/management-analysis",
      {
        tool_key: TOOL_KEY,
        requested_action: REQUESTED_ACTION,
        evidence,
      },
      config
    );

    if (!response.ok) {
      await recordInvocation({
        snapshot,
        evidence,
        actor,
        responseBody: body,
        status: "rejected",
        errorCode: "POINT10_MANAGEMENT_ANALYSIS_FAILED",
      });
      throw createServiceError(`AI Gateway management analysis returned HTTP ${response.status}.`, response.status, {
        code: body?.code || body?.detail?.code || "POINT10_MANAGEMENT_ANALYSIS_FAILED",
      });
    }

    assertIdentityEcho(body, evidence);
    const invocation = await recordInvocation({
      snapshot,
      evidence,
      actor,
      responseBody: body,
      status: "planned",
    });

    return {
      snapshot,
      analysis: body,
      invocationId: invocation._id,
      deterministicBaseline: true,
      modelInferenceExecuted: false,
      executionAuthorised: false,
      externalWriteAuthorised: false,
      message: "Canonical single-location BI evidence was interpreted by the governed Python statistical baseline and audited. No model inference or external action occurred.",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      await recordInvocation({
        snapshot,
        evidence,
        actor,
        status: "failed",
        errorCode: "POINT10_MANAGEMENT_ANALYSIS_TIMEOUT",
      });
      throw createServiceError("AI Gateway management analysis timed out.", 504, {
        code: "POINT10_MANAGEMENT_ANALYSIS_TIMEOUT",
      });
    }
    throw error;
  }
}

export default { analyseManagementBiWithPython };
