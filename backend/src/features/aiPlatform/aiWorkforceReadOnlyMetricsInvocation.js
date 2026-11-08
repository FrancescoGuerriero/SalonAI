import mongoose from "mongoose";
import AiAgentRun from "./AiAgentRun.js";
import AuditLog from "../../models/AuditLog.js";
import { getBuiltinAiAgentDefinition } from "./aiWorkforceBuiltinAgents.js";
import { requireAiWorkforceTool } from "./aiWorkforceToolRegistry.js";
import { previewAiWorkforceToolInvocation } from "./aiWorkforceOrchestrationPreview.js";
import { assertEffectivePermission } from "../../services/effectiveAuthorityService.js";
import { buildManagementCopilotPayload } from "../aiRecommendations/aiManagementCopilotService.js";
import { APPOINTMENT_METRIC_KEYS, getMetricDefinition } from "../analytics/metricCatalogue.js";
import { withBoundedAiRead, DEFAULT_AI_READ_TIMEOUT_MS } from "./aiWorkforceReadDeadline.js";

const TOOL_KEY = "business.metrics.read";
const AGENT_KEY = "business-adviser";

function denied(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function validId(value) {
  return mongoose.isValidObjectId(value);
}

export function validateAiWorkforceMetricEvidence(metrics, effectiveAuthority) {
  if (!Array.isArray(metrics) || metrics.length > APPOINTMENT_METRIC_KEYS.length) {
    denied("Canonical metrics returned invalid bounded evidence.", "AI_TOOL_EVIDENCE_INVALID");
  }
  const seen = new Set();
  return metrics.map((metric) => {
    if (!metric || typeof metric !== "object" || !APPOINTMENT_METRIC_KEYS.includes(metric.key) ||
        seen.has(metric.key)) {
      denied("Canonical metrics contain unknown or duplicate definitions.", "AI_TOOL_METRIC_NOT_REGISTERED");
    }
    seen.add(metric.key);
    const definition = getMetricDefinition(metric.key);
    for (const permission of definition.requiredPermissions) {
      assertEffectivePermission(effectiveAuthority, permission);
    }
    if (metric.version !== definition.version || metric.unit !== definition.unit ||
        !Number.isFinite(metric.value) || typeof metric.label !== "string" ||
        metric.label !== definition.label) {
      denied("Canonical metric evidence does not match its registered definition.", "AI_TOOL_METRIC_EVIDENCE_INVALID");
    }
    return {
      key: metric.key,
      version: definition.version,
      label: definition.label,
      value: metric.value,
      unit: definition.unit,
    };
  });
}

/**
 * Internal A0 canonical metrics invocation. No HTTP endpoint or LLM is
 * exposed by this slice. Dependencies are injectable ONLY for isolated tests.
 * All trust-bearing arguments must come from backend middleware/services.
 */
export async function invokeGovernedBusinessMetrics(
  {
    effectiveAuthority,
    composition,
    enabledEntitlements = [],
    user,
    locationId = null,
    periodDays = 30,
    requestId = "",
    timeoutMs = DEFAULT_AI_READ_TIMEOUT_MS,
    signal = null,
  } = {},
  {
    readMetrics = buildManagementCopilotPayload,
    runs = AiAgentRun,
    audits = AuditLog,
  } = {}
) {
  const agent = getBuiltinAiAgentDefinition(AGENT_KEY);
  const tool = requireAiWorkforceTool(TOOL_KEY);
  const actor = user?._id || user?.id;
  if (!validId(actor)) {
    denied("An authenticated AI tool actor is required.", "AI_TOOL_ACTOR_REQUIRED", 401);
  }
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365) {
    denied("Metrics period must be an integer from 1 to 365 days.", "AI_TOOL_PERIOD_INVALID", 400);
  }

  // This is an invocation-time revalidation, not reliance on an earlier
  // planning decision. All tenant, entitlement, location and RBAC checks
  // are repeated before any database read or run creation.
  const decision = previewAiWorkforceToolInvocation({
    agent,
    toolKey: TOOL_KEY,
    requestedAutonomy: "A0",
    effectiveAuthority,
    composition,
    enabledEntitlements,
    locationId,
  });
  // The tool registry grants ai:use; this canonical Appointment-derived
  // metric reader additionally requires the source-domain read permission.
  assertEffectivePermission(effectiveAuthority, "appointment:read");
  // Invalid deadlines or already cancelled requests must not create a run.
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30_000 ||
      (signal && signal.aborted)) {
    denied("AI read deadline is invalid or cancelled.", "AI_READ_DEADLINE_INVALID", 400);
  }
  const businessId = decision.businessId;
  const selectedLocationId = decision.locationId;
  const startedAt = new Date();
  const safeRequestId = String(requestId || "").slice(0, 160);

  const record = await runs.create({
    business: businessId,
    location: selectedLocationId,
    agentKey: agent.key,
    agentVersion: agent.version,
    initiatorType: "user",
    initiatedBy: actor,
    requestedAutonomy: "A0",
    effectiveAutonomy: "A0",
    status: "started",
    startedAt,
    requestId: safeRequestId,
    toolInvocations: [{
      toolKey: tool.key,
      requiredPermission: tool.requiredPermission,
      riskLevel: tool.riskLevel,
      status: "allowed",
      startedAt,
    }],
    metadata: { purpose: "canonical-aggregate-metrics", aggregateOnly: true },
  });

  let state = "failed";
  let metrics = null;
  let caughtError = null;
  try {
    const payload = await withBoundedAiRead(
      ({ signal: readSignal, timeoutMs: readTimeoutMs }) => readMetrics({
        businessId,
        locationId: selectedLocationId,
        locationAccessMode: effectiveAuthority.locationAccessMode,
        allowedLocationIds: effectiveAuthority.allowedLocationIds || [],
        periodDays,
        includeActionPlan: false,
        timeoutMs: readTimeoutMs,
        signal: readSignal,
      }),
      { timeoutMs, signal },
    );
    // A delegated reader must not be able to substitute another tenant or
    // location. Fail closed on missing/changed provenance.
    if (String(payload?.scope?.businessId || "") !== businessId ||
        String(payload?.scope?.locationId || "") !== String(selectedLocationId || "") ||
        payload?.scope?.tenantScoped !== true) {
      denied("Canonical metrics returned invalid scope evidence.", "AI_TOOL_EVIDENCE_SCOPE_MISMATCH");
    }
    metrics = validateAiWorkforceMetricEvidence(payload.metrics, effectiveAuthority);
    state = "completed";
  } catch (error) {
    caughtError = error;
  }

  const completedAt = new Date();
  // No unrestricted prompt, customer row, token or raw error is written.
  try {
    await runs.updateOne(
      { _id: record._id, business: businessId },
      {
        $set: {
          status: state,
          completedAt,
          latencyMs: Math.max(0, completedAt - startedAt),
          "toolInvocations.0.status": state,
          "toolInvocations.0.completedAt": completedAt,
          "toolInvocations.0.evidenceRefs": state === "completed"
            ? ["canonical:appointments:aggregate"] : [],
          "outcome.taskSuccess": state === "completed",
        },
      }
    );
    await audits.create({
      actor,
      action: "ai_workforce.read_only_tool_invoked",
      resourceType: "AiAgentRun",
      resourceId: String(record._id),
      requestId: safeRequestId,
      after: {
        status: state, toolKey: TOOL_KEY, effectiveAutonomy: "A0",
        metricCount: metrics?.length || 0,
        failureCategory: caughtError?.code === "AI_READ_TIMEOUT" ? "deadline" :
          caughtError?.code === "AI_READ_CANCELLED" ? "cancelled" :
          state === "failed" ? "read_or_evidence" : null,
      },
      metadata: {
        businessId, locationId: selectedLocationId,
        canonicalReadOnly: true, mutationAuthorised: false,
      },
    });
  } catch (error) {
    // Auditing is mandatory for an authorised invocation. Never return
    // unaudited results. A reconciliation check can find a started run.
    throw error;
  }

  if (caughtError) throw caughtError;
  return Object.freeze({
    businessId,
    locationId: selectedLocationId,
    agentRunId: String(record._id),
    toolKey: TOOL_KEY,
    autonomy: "A0",
    mutationAuthorised: false,
    metrics,
    evidenceRefs: ["canonical:appointments:aggregate"],
  });
}

export default invokeGovernedBusinessMetrics;
