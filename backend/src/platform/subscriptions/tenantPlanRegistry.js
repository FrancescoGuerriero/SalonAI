const PLAN_KEY_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TENANT_PLAN_STATUSES =
  Object.freeze([
    "active",
    "retired",
  ]);

const PLAN_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      key: "standard",
      version: "1",
      label: "Standard",
      status: "active",
    }),
    Object.freeze({
      key: "ai-business",
      version: "1",
      label: "AI Business",
      status: "active",
    }),
  ]);

function clean(value) {
  return String(
    value || ""
  ).trim();
}

function normaliseKey(value) {
  const key =
    clean(value)
      .toLowerCase();

  if (
    !PLAN_KEY_PATTERN.test(
      key
    )
  ) {
    const error =
      new Error(
        "Tenant plan key is invalid."
      );
    error.code =
      "INVALID_TENANT_PLAN_KEY";
    throw error;
  }

  return key;
}

export function listTenantPlans({
  includeRetired = false,
} = {}) {
  return Object.freeze(
    PLAN_DEFINITIONS
      .filter(
        (definition) =>
          includeRetired ||
          definition.status ===
            "active"
      )
      .map(
        (definition) =>
          Object.freeze({
            ...definition,
          })
      )
  );
}

export function getTenantPlan(
  planKey,
  {
    includeRetired = false,
  } = {}
) {
  const key =
    normaliseKey(
      planKey
    );

  const definition =
    PLAN_DEFINITIONS.find(
      (candidate) =>
        candidate.key ===
          key &&
        (
          includeRetired ||
          candidate.status ===
            "active"
        )
    );

  if (
    !definition
  ) {
    const error =
      new Error(
        "Tenant plan is not registered."
      );
    error.code =
      "TENANT_PLAN_NOT_REGISTERED";
    throw error;
  }

  return Object.freeze({
    ...definition,
  });
}

export function isTenantPlanRegistered(
  planKey
) {
  try {
    getTenantPlan(
      planKey
    );
    return true;
  } catch {
    return false;
  }
}

export default Object.freeze({
  listTenantPlans,
  getTenantPlan,
  isTenantPlanRegistered,
});
