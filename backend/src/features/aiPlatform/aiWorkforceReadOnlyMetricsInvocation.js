import mongoose from "mongoose";
import AiAgentRun from "./AiAgentRun.js";
import AuditLog from "../../models/AuditLog.js";
import { getBuiltinAiAgentDefinition } from "./aiWorkforceBuiltinAgents.js";
import { requireAiWorkforceTool } from "./aiWorkforceToolRegistry.js";
import { previewAiWorkforceToolInvocation } from "./aiWorkforceOrchestrationPreview.js";
import { assertEffectivePermission } from "../../services/effectiveAuthorityService.js";
import { buildManagementCopilotPayload } from "../aiRecommendations/aiManagementCopilotService.js";

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
  // The tool registry grants ai:use; this canonical Appointment-derived\n  // metric reader additionally requires the source-domain read permission.\n  assertEffectivePermission(effectiveAuthority, "appointment:read");\n  const businessId = decision.businessId;
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
    const payload = await readMetrics({
      businessId,
      locationId: selectedLocationId,
      locationAccessMode: effectiveAuthority.locationAccessMode,
      allowedLocationIds: effectiveAuthority.allowedLocationIds || [],
      periodDays,
      includeActionPlan: false,
    });
    // A delegated reader must not be able to substitute another tenant or
    // location. Fail closed on missing/changed provenance.
    if (String(payload?.scope?.businessId || "") !== businessId ||
        String(payload?.scope?.locationId || "") !== String(selectedLocationId || "") ||
        payload?.scope?.tenantScoped !== true) {
      denied("Canonical metrics returned invalid scope evidence.", "AI_TOOL_EVIDENCE_SCOPE_MISMATCH");
    }
    if (!Array.isArray(payload.metrics) || payload.metrics.length > 30) {
      denied("Canonical metrics returned invalid bounded evidence.", "AI_TOOL_EVIDENCE_INVALID");
    }
    metrics = payload.metrics.map(({ key, version, label, value, unit }) => ({
      key, version, label, value, unit,
    }));
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
