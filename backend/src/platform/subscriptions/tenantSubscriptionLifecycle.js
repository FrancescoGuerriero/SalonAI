import { createHash } from "node:crypto";
import { getTenantPlan } from "./tenantPlanRegistry.js";

export const TENANT_SUBSCRIPTION_STATES = Object.freeze([
  "provisioning", "trial", "active", "past_due", "suspended", "cancelled", "archived",
]);

export const TENANT_SUBSCRIPTION_ACTIONS = Object.freeze([
  "start_trial", "activate", "mark_past_due", "suspend", "reactivate", "cancel", "archive", "change_plan",
]);

const transitions = Object.freeze({
  provisioning: ["trial", "active", "cancelled"],
  trial: ["active", "past_due", "suspended", "cancelled"],
  active: ["past_due", "suspended", "cancelled"],
  past_due: ["active", "suspended", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: ["archived"],
  archived: [],
});

const actionTarget = Object.freeze({
  start_trial: "trial",
  activate: "active",
  mark_past_due: "past_due",
  suspend: "suspended",
  reactivate: "active",
  cancel: "cancelled",
  archive: "archived",
});

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

const clean = (value) => String(value || "").trim();

function iso(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${field} must be a valid date.`, "INVALID_TENANT_SUBSCRIPTION_DATE");
  return date.toISOString();
}

export function normaliseTenantEntitlementGrants(grants = []) {
  if (!Array.isArray(grants)) fail("Entitlement grants must be an array.", "INVALID_TENANT_ENTITLEMENTS");
  const seen = new Set();
  return Object.freeze(grants.map((grant) => {
    const key = clean(grant?.key);
    if (!key) fail("Entitlement grant key is required.", "INVALID_TENANT_ENTITLEMENT");
    if (seen.has(key)) fail("Entitlement grant keys must be unique.", "DUPLICATE_TENANT_ENTITLEMENT");
    seen.add(key);
    const limit = grant?.limit == null ? null : Number(grant.limit);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      fail("Entitlement limit must be a non-negative finite number.", "INVALID_TENANT_ENTITLEMENT_LIMIT");
    }
    return Object.freeze({ key, source: clean(grant?.source || "plan").toLowerCase(), limit });
  }).sort((a, b) => a.key.localeCompare(b.key)));
}

export function normaliseTenantSubscriptionSnapshot(input = {}) {
  const businessId = clean(input.businessId);
  if (!businessId) fail("Business id is required.", "TENANT_SUBSCRIPTION_BUSINESS_REQUIRED");

  const plan = getTenantPlan(input.planKey || "standard");
  const planVersion = clean(input.planVersion || plan.version);
  if (planVersion !== plan.version) fail("Tenant plan version is not registered.", "TENANT_PLAN_VERSION_NOT_REGISTERED");

  const status = clean(input.status || "provisioning");
  if (!TENANT_SUBSCRIPTION_STATES.includes(status)) fail("Tenant subscription status is invalid.", "INVALID_TENANT_SUBSCRIPTION_STATUS");

  const lifecycleRevision = Number(input.lifecycleRevision || 1);
  if (!Number.isInteger(lifecycleRevision) || lifecycleRevision < 1) {
    fail("Lifecycle revision must be a positive integer.", "INVALID_TENANT_SUBSCRIPTION_REVISION");
  }

  return Object.freeze({
    businessId,
    planKey: plan.key,
    planVersion,
    status,
    entitlementGrants: normaliseTenantEntitlementGrants(input.entitlementGrants || []),
    lifecycleRevision,
    trialStartedAt: iso(input.trialStartedAt, "trialStartedAt"),
    trialEndsAt: iso(input.trialEndsAt, "trialEndsAt"),
    currentPeriodStart: iso(input.currentPeriodStart, "currentPeriodStart"),
    currentPeriodEnd: iso(input.currentPeriodEnd, "currentPeriodEnd"),
    gracePeriodEndsAt: iso(input.gracePeriodEndsAt, "gracePeriodEndsAt"),
    cancelledAt: iso(input.cancelledAt, "cancelledAt"),
    suspendedAt: iso(input.suspendedAt, "suspendedAt"),
    archivedAt: iso(input.archivedAt, "archivedAt"),
    provider: clean(input.provider),
    providerCustomerRef: clean(input.providerCustomerRef),
    providerSubscriptionRef: clean(input.providerSubscriptionRef),
    lastProviderEventId: clean(input.lastProviderEventId),
    lastProviderEventAt: iso(input.lastProviderEventAt, "lastProviderEventAt"),
  });
}

export function assertTenantSubscriptionTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  if (!TENANT_SUBSCRIPTION_STATES.includes(fromStatus) || !TENANT_SUBSCRIPTION_STATES.includes(toStatus)) {
    fail("Tenant subscription transition contains an invalid status.", "INVALID_TENANT_SUBSCRIPTION_STATUS");
  }
  if (!transitions[fromStatus].includes(toStatus)) {
    fail(`Tenant subscription cannot transition from ${fromStatus} to ${toStatus}.`, "TENANT_SUBSCRIPTION_TRANSITION_NOT_ALLOWED");
  }
  return true;
}

function providerEventFor(current, providerEvent) {
  if (!providerEvent) return null;
  const event = {
    provider: clean(providerEvent.provider),
    externalEventId: clean(providerEvent.externalEventId),
    occurredAt: iso(providerEvent.occurredAt, "providerEvent.occurredAt"),
  };
  if (!event.provider || !event.externalEventId || !event.occurredAt) {
    fail("Provider events require provider, externalEventId and occurredAt.", "INVALID_TENANT_PROVIDER_EVENT");
  }
  if (current.lastProviderEventId === event.externalEventId) {
    fail("Provider event has already been applied.", "DUPLICATE_TENANT_PROVIDER_EVENT");
  }
  if (current.lastProviderEventAt && new Date(event.occurredAt) <= new Date(current.lastProviderEventAt)) {
    fail("Provider event is stale.", "STALE_TENANT_PROVIDER_EVENT");
  }
  return Object.freeze(event);
}

export function planTenantSubscriptionTransition({
  current, action, effectiveAt, nextPlanKey = null, nextPlanVersion = null,
  entitlementGrants = null, gracePeriodEndsAt = null, providerEvent = null,
} = {}) {
  const snapshot = normaliseTenantSubscriptionSnapshot(current);
  const normalisedAction = clean(action).toLowerCase();
  if (!TENANT_SUBSCRIPTION_ACTIONS.includes(normalisedAction)) {
    fail("Tenant subscription action is invalid.", "INVALID_TENANT_SUBSCRIPTION_ACTION");
  }

  const toStatus = normalisedAction === "change_plan" ? snapshot.status : actionTarget[normalisedAction];
  if (normalisedAction !== "change_plan") assertTenantSubscriptionTransition(snapshot.status, toStatus);

  const plan = getTenantPlan(nextPlanKey || snapshot.planKey);
  const planVersion = clean(nextPlanVersion || plan.version);
  if (planVersion !== plan.version) fail("Target tenant plan version is not registered.", "TENANT_PLAN_VERSION_NOT_REGISTERED");

  const result = {
    businessId: snapshot.businessId,
    action: normalisedAction,
    fromStatus: snapshot.status,
    toStatus,
    fromPlanKey: snapshot.planKey,
    toPlanKey: plan.key,
    fromPlanVersion: snapshot.planVersion,
    toPlanVersion: planVersion,
    fromRevision: snapshot.lifecycleRevision,
    toRevision: snapshot.lifecycleRevision + 1,
    entitlementGrants: entitlementGrants === null ? snapshot.entitlementGrants : normaliseTenantEntitlementGrants(entitlementGrants),
    effectiveAt: iso(effectiveAt || new Date(), "effectiveAt"),
    gracePeriodEndsAt: iso(gracePeriodEndsAt, "gracePeriodEndsAt"),
    providerEvent: providerEventFor(snapshot, providerEvent),
    writesPerformed: false,
  };

  const fingerprintPayload = {
    businessId: result.businessId, action: result.action, fromStatus: result.fromStatus, toStatus: result.toStatus,
    fromPlanKey: result.fromPlanKey, toPlanKey: result.toPlanKey, fromPlanVersion: result.fromPlanVersion,
    toPlanVersion: result.toPlanVersion, fromRevision: result.fromRevision, toRevision: result.toRevision,
    entitlementGrants: result.entitlementGrants, effectiveAt: result.effectiveAt,
    gracePeriodEndsAt: result.gracePeriodEndsAt, providerEvent: result.providerEvent,
  };
  return Object.freeze({
    ...result,
    transitionFingerprint: createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex"),
  });
}

export function resolveTenantEntitlements(subscription) {
  const snapshot = normaliseTenantSubscriptionSnapshot(subscription);
  if (!["trial", "active", "past_due"].includes(snapshot.status)) return Object.freeze([]);
  return Object.freeze(snapshot.entitlementGrants.map((grant) => grant.key));
}

export default Object.freeze({
  normaliseTenantSubscriptionSnapshot,
  normaliseTenantEntitlementGrants,
  assertTenantSubscriptionTransition,
  planTenantSubscriptionTransition,
  resolveTenantEntitlements,
});
