import crypto from "node:crypto";

const PREVIEW_SCHEMA = "salonai.customer-import-preview.v1";
const PLAN_SCHEMA = "salonai.customer-import-apply-plan.v1";
const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_ACTIONS = new Set(["create", "skip", "match_existing"]);

function approvalError(message, code = "INVALID_CUSTOMER_IMPORT_APPROVAL") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function compactText(value, maximum = 500) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

function requireObjectId(value, label) {
  const text = compactText(value, 24);
  if (!OBJECT_ID_PATTERN.test(text)) {
    throw approvalError(`${label} must be a 24-character MongoDB ObjectId.`);
  }
  return text.toLowerCase();
}

function requireFingerprint(value, label) {
  const text = compactText(value, 64).toLowerCase();
  if (!FINGERPRINT_PATTERN.test(text)) {
    throw approvalError(`${label} must be a SHA-256 fingerprint.`);
  }
  return text;
}

function stableFingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function decisionForRow(decisions, rowNumber) {
  const value = decisions?.[rowNumber] ?? decisions?.[String(rowNumber)] ?? null;
  if (!value) return null;
  if (typeof value === "string") return { action: value };
  if (typeof value === "object" && !Array.isArray(value)) return value;
  throw approvalError(`Row ${rowNumber} has an invalid approval decision.`);
}

function validatePreview(preview) {
  if (!preview || preview.schema !== PREVIEW_SCHEMA) {
    throw approvalError(`Customer import approval requires a ${PREVIEW_SCHEMA} preview.`);
  }
  if (!FINGERPRINT_PATTERN.test(String(preview.fingerprint || ""))) {
    throw approvalError("Customer import preview fingerprint is invalid.");
  }
  if (!Array.isArray(preview.rows) || preview.rows.length === 0) {
    throw approvalError("Customer import preview contains no rows.");
  }
  if (preview.governance?.databaseWritesAllowed !== false) {
    throw approvalError("Customer import preview must remain zero-write governed evidence.");
  }
}

export function buildCustomerImportApprovalPlan(
  preview,
  {
    expectedPreviewFingerprint,
    businessId,
    approvedBy,
    approvedAt = new Date().toISOString(),
    decisions = {},
    note = "",
  } = {}
) {
  validatePreview(preview);

  const expectedFingerprint = requireFingerprint(
    expectedPreviewFingerprint,
    "expectedPreviewFingerprint"
  );
  if (expectedFingerprint !== preview.fingerprint) {
    throw approvalError(
      "Customer import preview fingerprint changed; regenerate and review the preview before approval.",
      "CUSTOMER_IMPORT_PREVIEW_FINGERPRINT_MISMATCH"
    );
  }

  const tenantBusinessId = requireObjectId(businessId, "businessId");
  const administratorId = requireObjectId(approvedBy, "approvedBy");
  const approvalTimestamp = new Date(approvedAt);
  if (Number.isNaN(approvalTimestamp.getTime())) {
    throw approvalError("approvedAt must be a valid date/time.");
  }

  const operations = [];
  const unresolvedRows = [];

  for (const row of preview.rows) {
    const rowNumber = Number(row?.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
      throw approvalError("Customer import preview contains an invalid row number.");
    }

    if (Array.isArray(row.errors) && row.errors.length > 0) {
      unresolvedRows.push({
        rowNumber,
        reason: "preview_errors",
        details: [...row.errors],
      });
      continue;
    }

    const warnings = Array.isArray(row.warnings) ? row.warnings : [];
    const decision = decisionForRow(decisions, rowNumber);

    if (warnings.length > 0 && !decision) {
      unresolvedRows.push({
        rowNumber,
        reason: "warning_requires_explicit_decision",
        details: [...warnings],
      });
      continue;
    }

    const action = compactText(decision?.action || "create", 40).toLowerCase();
    if (!ALLOWED_ACTIONS.has(action)) {
      throw approvalError(`Row ${rowNumber} uses unsupported action ${action}.`);
    }

    let matchedCustomerId = "";
    if (action === "match_existing") {
      matchedCustomerId = requireObjectId(
        decision?.matchedCustomerId,
        `Row ${rowNumber} matchedCustomerId`
      );
    }

    if (action === "create" && warnings.some((warning) => /matches an existing customer/i.test(warning))) {
      throw approvalError(
        `Row ${rowNumber} matches an existing customer and cannot be approved for create without resolving the collision.`
      );
    }

    operations.push({
      rowNumber,
      action,
      businessId: tenantBusinessId,
      ...(matchedCustomerId ? { matchedCustomerId } : {}),
      customer: action === "create" ? row.customer : undefined,
      warnings: [...warnings],
    });
  }

  if (unresolvedRows.length > 0) {
    const error = approvalError(
      `Customer import approval has ${unresolvedRows.length} unresolved row(s).`,
      "CUSTOMER_IMPORT_APPROVAL_INCOMPLETE"
    );
    error.unresolvedRows = unresolvedRows;
    throw error;
  }

  const canonicalPlan = {
    schema: PLAN_SCHEMA,
    previewFingerprint: preview.fingerprint,
    sourceName: compactText(preview.sourceName, 200),
    businessId: tenantBusinessId,
    approvedBy: administratorId,
    approvedAt: approvalTimestamp.toISOString(),
    note: compactText(note, 1000),
    operations,
  };

  return Object.freeze({
    ...canonicalPlan,
    operationCount: operations.length,
    createCount: operations.filter((operation) => operation.action === "create").length,
    skipCount: operations.filter((operation) => operation.action === "skip").length,
    matchExistingCount: operations.filter((operation) => operation.action === "match_existing").length,
    fingerprint: stableFingerprint(canonicalPlan),
    governance: Object.freeze({
      approvalPlanOnly: true,
      databaseWritesAllowed: false,
      separateExecutorRequired: true,
      canonicalCustomerAuthorityRequired: true,
      tenantOwnershipExplicit: true,
      previewFingerprintBound: true,
      marketingConsentImported: false,
      trainingEligibilityInferred: false,
    }),
  });
}

export default {
  buildCustomerImportApprovalPlan,
};
