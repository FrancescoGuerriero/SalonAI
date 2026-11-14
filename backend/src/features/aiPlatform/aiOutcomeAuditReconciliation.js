import mongoose from "mongoose";
import AiActionOutcome from "./AiActionOutcome.js";
import AuditLog from "../../models/AuditLog.js";
import { aiWorkforceLocationMatch } from "./aiWorkforceGovernanceService.js";
import { assertEffectivePermission } from "../../services/effectiveAuthorityService.js";

const ACTION = "ai_workforce.proposal_outcome_observed";
const MAX_RESULTS = 100;

function reject(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  throw error;
}

/**
 * Read-only AI outcome/audit consistency inspector.
 * All source queries are tenant-scoped. Only outcomes within the caller's
 * location membership are inspected. An audit row never grants authority.
 * This diagnostic performs no repair or approval.
 */
export async function inspectAiOutcomeAuditIntegrity({
  effectiveAuthority,
  locationId = null,
  limit = 50,
} = {}, {
  outcomes = AiActionOutcome,
  audits = AuditLog,
} = {}) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    reject("Trusted AI outcome business authority is required.", "AI_OUTCOME_RECONCILIATION_TENANT_REQUIRED");
  }
  assertEffectivePermission(effectiveAuthority, "ai:use");
  assertEffectivePermission(effectiveAuthority, "reports:read");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
    reject("AI outcome reconciliation limit is invalid.", "AI_OUTCOME_RECONCILIATION_INVALID_LIMIT");
  }
  const locationMatch = aiWorkforceLocationMatch(effectiveAuthority, locationId);
  const rows = await outcomes.find({
    business: businessId,
    ...locationMatch,
  }).sort({ observedAt: -1, _id: -1 }).limit(limit).lean();

  if (!Array.isArray(rows)) {
    reject("AI outcome evidence is unavailable.", "AI_OUTCOME_RECONCILIATION_OUTCOMES_UNAVAILABLE");
  }
  const ids = new Set();
  const proposals = new Set();
  for (const row of rows) {
    const id = String(row?._id || "");
    const proposal = String(row?.proposal || "");
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(proposal) ||
        String(row?.business || "") !== businessId || ids.has(id)) {
      reject("AI outcome evidence is malformed, duplicated or cross-tenant.", "AI_OUTCOME_RECONCILIATION_INVALID_OUTCOMES");
    }
    ids.add(id);
    proposals.add(proposal);
  }

  const evidence = proposals.size ? await audits.find({
    action: ACTION,
    resourceType: "AiActionProposal",
    resourceId: { $in: [...proposals] },
    "metadata.businessId": businessId,
  }).select("resourceId actor after.outcomeId after.status after.taskSuccess after.policyViolation after.reversed metadata.businessId metadata.requiredPermission metadata.automaticExecution").lean() : [];
  if (!Array.isArray(evidence)) {
    reject("AI outcome audit evidence is unavailable.", "AI_OUTCOME_RECONCILIATION_AUDITS_UNAVAILABLE");
  }

  const byOutcome = new Map();
  for (const entry of evidence) {
    const referenced = String(entry?.after?.outcomeId || "");
    if (!ids.has(referenced)) continue;
    byOutcome.set(referenced, [...(byOutcome.get(referenced) || []), entry]);
  }

  // The main outcome query is bounded. Do not call every audit reference
  // missing from that page an orphan: it may belong to an older outcome.
  // Resolve unmatched references against tenant-owned records first.
  const unlisted = evidence.filter((entry) =>
    !ids.has(String(entry?.after?.outcomeId || "")));
  const referencedIds = [...new Set(unlisted.map((entry) =>
    String(entry?.after?.outcomeId || "")).filter((id) => mongoose.isValidObjectId(id)))];
  const referencedRows = referencedIds.length ? await outcomes.find({
    business: businessId,
    _id: { $in: referencedIds },
  }).select("_id proposal").lean() : [];
  if (!Array.isArray(referencedRows)) {
    reject("AI audit reference lookup is unavailable.",
      "AI_OUTCOME_RECONCILIATION_REFERENCES_UNAVAILABLE");
  }
  const ownedReferences = new Map();
  for (const related of referencedRows) {
    const id = String(related?._id || "");
    if (!mongoose.isValidObjectId(id) ||
        String(related?.proposal || "") === "" || ownedReferences.has(id)) {
      reject("AI audit reference lookup is malformed.",
        "AI_OUTCOME_RECONCILIATION_INVALID_REFERENCES");
    }
    ownedReferences.set(id, String(related.proposal));
  }

  const discrepancies = [];
  for (const entry of unlisted) {
    const id = String(entry?.after?.outcomeId || "");
    const proposal = String(entry?.resourceId || "");
    // Only report the proposal already inside the caller's visible sample.
    // Never return the foreign or malformed outcome ID from an audit row.
    if (!proposals.has(proposal)) continue;
    const linkedProposal = ownedReferences.get(id);
    if (!mongoose.isValidObjectId(id) || !linkedProposal) {
      discrepancies.push(Object.freeze({
        outcomeId: null, proposalId: proposal, issue: "orphan_outcome_audit",
      }));
    } else if (linkedProposal !== proposal) {
      discrepancies.push(Object.freeze({
        outcomeId: null, proposalId: proposal, issue: "audit_outcome_proposal_mismatch",
      }));
    }
  }
  for (const row of rows) {
    const id = String(row._id);
    const matching = byOutcome.get(id) || [];
    let issue = null;
    if (matching.length === 0) {
      issue = "missing_outcome_audit";
    } else if (matching.length > 1) {
      issue = "duplicate_outcome_audit";
    } else {
      const entry = matching[0];
      if (String(entry.resourceId || "") !== String(row.proposal) ||
          String(entry.actor || "") !== String(row.observedBy || "") ||
          entry.after?.status !== row.status ||
          entry.after?.taskSuccess !== row.taskSuccess ||
          entry.after?.policyViolation !== row.policyViolation ||
          entry.after?.reversed !== row.reversed ||
          entry.metadata?.automaticExecution !== false) {
        issue = "outcome_audit_provenance_mismatch";
      }
    }
    if (issue) {
      discrepancies.push(Object.freeze({
        outcomeId: id,
        proposalId: String(row.proposal),
        issue,
      }));
    }
  }
  return Object.freeze({
    businessId,
    inspectedCount: rows.length,
    discrepancyCount: discrepancies.length,
    discrepancies: Object.freeze(discrepancies),
    truncated: rows.length === limit,
    readOnly: true,
    repairPerformed: false,
    productionAccepted: null,
  });
}

export default inspectAiOutcomeAuditIntegrity;
