import mongoose from "mongoose";

export const TENANT_FIELD = "business";

function tenantError(message, code = "INVALID_TENANT_CONTEXT") {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

export function normaliseTenantId(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value
      ? value._id
      : value;

  const text = String(candidate || "").trim();

  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw tenantError("A valid business tenant id is required.");
  }

  return text;
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object"
  ) {
    throw tenantError(`${label} must be an object.`);
  }
}

function assertCompatibleExistingTenant(target, tenantId) {
  if (
    target[TENANT_FIELD] !== undefined &&
    target[TENANT_FIELD] !== null &&
    String(target[TENANT_FIELD]) !== tenantId
  ) {
    throw tenantError(
      "The supplied database operation conflicts with the active business tenant.",
      "TENANT_SCOPE_CONFLICT"
    );
  }
}

export function tenantFilter(tenantId, filter = {}) {
  const normalisedTenantId = normaliseTenantId(tenantId);
  assertPlainObject(filter, "Tenant query filter");
  assertCompatibleExistingTenant(filter, normalisedTenantId);

  return {
    ...filter,
    [TENANT_FIELD]: normalisedTenantId,
  };
}

export function stampTenant(tenantId, values = {}) {
  const normalisedTenantId = normaliseTenantId(tenantId);
  assertPlainObject(values, "Tenant document values");
  assertCompatibleExistingTenant(values, normalisedTenantId);

  return {
    ...values,
    [TENANT_FIELD]: normalisedTenantId,
  };
}

export function assertTenantOwnership(tenantId, record) {
  const normalisedTenantId = normaliseTenantId(tenantId);

  if (!record || String(record[TENANT_FIELD] || "") !== normalisedTenantId) {
    const error = new Error(
      "The requested resource does not belong to the active business tenant."
    );
    error.statusCode = 404;
    error.code = "TENANT_RESOURCE_NOT_FOUND";
    throw error;
  }

  return record;
}
