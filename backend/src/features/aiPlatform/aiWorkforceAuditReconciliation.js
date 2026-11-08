import mongoose from "mongoose";
import AiAgentRun from "./AiAgentRun.js";
import AuditLog from "../../models/AuditLog.js";
import { aiWorkforceLocationMatch } from "./aiWorkforceGovernanceService.js";
import { assertEffectivePermission } from "../../services/effectiveAuthorityService.js";

const AUDIT_ACTION = "ai_workforce.read_only_tool_invoked";
const MAX_RESULTS = 100;
const MIN_STALE_MS = 60_000;

function bad(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  throw error;
}

/**
 * Read-only internal reconciliation report for canonical A0 metrics runs.
 * All queries include the trusted business. Never repair or rerun a tool
 * automatically; this lists actionable evidence discrepancies for DEV1.
 */
export async function inspectAiMetricsRunAuditIntegrity({
  effectiveAuthority,
  locationId = null,
  now = new Date(),
  staleAfterMs = 5 * 60_000,
  limit = 50,
} = {}, {
  runs = AiAgentRun,
  audits = AuditLog,
} = {}) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    bad("Trusted AI Workforce business authority is required.", "AI_RECONCILIATION_TENANT_REQUIRED");
  }
  assertEffectivePermission(effectiveAuthority, "ai:use");
  assertEffectivePermission(effectiveAuthority, "reports:read");
  const locationMatch = aiWorkforceLocationMatch(effectiveAuthority, locationId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS ||
      !Number.isInteger(staleAfterMs) || staleAfterMs < MIN_STALE_MS ||
      !(now instanceof Date) || Number.isNaN(now.getTime())) {
    bad("Reconciliation limits and clock are invalid.", "AI_RECONCILIATION_INVALID_PARAMETERS");
  }
  const eligible = await runs.find({
    business: businessId,
    ...locationMatch,
    agentKey: "business-adviser",
    "metadata.purpose": "canonical-aggregate-metrics",
    status: { $in: ["started", "completed", "failed"] },
  }).sort({ startedAt: -1 }).limit(limit).lean();

  if (!Array.isArray(eligible)) {
    bad("AI run evidence is unavailable.", "AI_RECONCILIATION_RUNS_UNAVAILABLE");
  }
  const runIds = eligible.map((run) => String(run._id));
  const seen = new Set();
  if (runIds.some((id) => !mongoose.isValidObjectId(id) || seen.has(id) || !seen.add(id))) {
    bad("AI run identifiers are malformed or duplicated.", "AI_RECONCILIATION_INVALID_RUNS");
  }
  const auditRows = runIds.length ? await audits.find({
    resourceType: "AiAgentRun",
    action: AUDIT_ACTION,
    resourceId: { $in: runIds },
    "metadata.businessId": businessId,
  }).select("resourceId after.status after.toolKey metadata.businessId metadata.locationId").lean() : [];
  if (!Array.isArray(auditRows)) {
    bad("AI audit evidence is unavailable.", "AI_RECONCILIATION_AUDITS_UNAVAILABLE");
  }
  const byRun = new Map();
  for (const audit of auditRows) {
    if (!runIds.includes(String(audit.resourceId))) continue;
    const id = String(audit.resourceId);
    byRun.set(id, [...(byRun.get(id) || []), audit]);
  }
  const discrepancies = [];
  for (const run of eligible) {
    const id = String(run._id);
    const age = now.getTime() - new Date(run.startedAt).getTime();
    const entries = byRun.get(id) || [];
    let issue = null;
    if (!Number.isFinite(age) || age < 0) {
      issue = "invalid_start_time";
    } else if (run.status === "started" && age >= staleAfterMs) {
      issue = "stale_started_run";
    } else if (run.status !== "started" && entries.length === 0) {
      issue = "missing_terminal_audit";
    } else if (run.status !== "started" && entries.length !== 1) {
      issue = "duplicate_terminal_audit";
    } else if (run.status !== "started" &&
        (entries[0].after?.status !== run.status ||
         entries[0].after?.toolKey !== "business.metrics.read" ||
         String(entries[0].metadata?.locationId || "") !== String(run.location || ""))) {
      issue = "audit_scope_or_status_mismatch";
    }
    if (issue) {
      discrepancies.push(Object.freeze({
        runId: id,
        locationId: run.location ? String(run.location) : null,
        status: run.status,
        issue,
      }));
    }
  }
  return Object.freeze({
    businessId,
    inspectedCount: eligible.length,
    discrepancyCount: discrepancies.length,
    discrepancies: Object.freeze(discrepancies),
    readOnly: true,
    repairPerformed: false,
    truncated: eligible.length === limit,
  });
}

export default inspectAiMetricsRunAuditIntegrity;
