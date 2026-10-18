import assert from "node:assert/strict";
import test from "node:test";

import {
  planTenantSubscriptionTransition,
  resolveTenantEntitlements,
} from "../platform/subscriptions/tenantSubscriptionLifecycle.js";
import {
  getTenantPlan,
  isTenantPlanRegistered,
  listTenantPlans,
} from "../platform/subscriptions/tenantPlanRegistry.js";

function subscription(overrides = {}) {
  return {
    businessId: "business-a",
    planKey: "standard",
    planVersion: "1",
    status: "provisioning",
    lifecycleRevision: 1,
    entitlementGrants: [{ key: "appointments", source: "plan" }],
    ...overrides,
  };
}

test("tenant plan registry exposes only registered provider-neutral plan identities", () => {
  assert.equal(isTenantPlanRegistered("standard"), true);
  assert.equal(getTenantPlan("ai-business").version, "1");
  assert.deepEqual(listTenantPlans().map((plan) => plan.key), ["standard", "ai-business"]);
  assert.throws(() => getTenantPlan("made-up-plan"), { code: "TENANT_PLAN_NOT_REGISTERED" });
});

test("subscription lifecycle permits provisioning to trial to active transitions", () => {
  const trial = planTenantSubscriptionTransition({
    current: subscription(),
    action: "start_trial",
    effectiveAt: "2026-10-18T12:00:00.000Z",
  });

  assert.equal(trial.fromStatus, "provisioning");
  assert.equal(trial.toStatus, "trial");
  assert.equal(trial.toRevision, 2);
  assert.match(trial.transitionFingerprint, /^[a-f0-9]{64}$/);

  const active = planTenantSubscriptionTransition({
    current: subscription({ status: "trial", lifecycleRevision: 2 }),
    action: "activate",
    effectiveAt: "2026-10-18T13:00:00.000Z",
  });
  assert.equal(active.toStatus, "active");
});

test("cancelled subscriptions cannot be silently reactivated", () => {
  assert.throws(
    () => planTenantSubscriptionTransition({
      current: subscription({ status: "cancelled", lifecycleRevision: 4 }),
      action: "activate",
      effectiveAt: "2026-10-18T13:00:00.000Z",
    }),
    { code: "TENANT_SUBSCRIPTION_TRANSITION_NOT_ALLOWED" }
  );
});

test("suspended subscriptions can be explicitly reactivated", () => {
  const plan = planTenantSubscriptionTransition({
    current: subscription({ status: "suspended", lifecycleRevision: 5 }),
    action: "reactivate",
    effectiveAt: "2026-10-18T13:00:00.000Z",
  });
  assert.equal(plan.toStatus, "active");
});

test("plan changes are deterministic and keep RBAC separate from entitlements", () => {
  const input = {
    current: subscription({ status: "active", lifecycleRevision: 3 }),
    action: "change_plan",
    nextPlanKey: "ai-business",
    entitlementGrants: [
      { key: "inventory", source: "plan" },
      { key: "appointments", source: "plan" },
    ],
    effectiveAt: "2026-10-18T14:00:00.000Z",
  };

  const first = planTenantSubscriptionTransition(input);
  const second = planTenantSubscriptionTransition(input);

  assert.equal(first.toPlanKey, "ai-business");
  assert.equal(first.fromStatus, "active");
  assert.equal(first.toStatus, "active");
  assert.equal(first.transitionFingerprint, second.transitionFingerprint);
  assert.deepEqual(first.entitlementGrants.map((grant) => grant.key), ["appointments", "inventory"]);
});

test("duplicate and stale provider events fail closed", () => {
  const current = subscription({
    status: "active",
    lifecycleRevision: 4,
    lastProviderEventId: "evt-1",
    lastProviderEventAt: "2026-10-18T12:00:00.000Z",
  });

  assert.throws(
    () => planTenantSubscriptionTransition({
      current,
      action: "mark_past_due",
      effectiveAt: "2026-10-18T13:00:00.000Z",
      providerEvent: {
        provider: "example-provider",
        externalEventId: "evt-1",
        occurredAt: "2026-10-18T13:00:00.000Z",
      },
    }),
    { code: "DUPLICATE_TENANT_PROVIDER_EVENT" }
  );

  assert.throws(
    () => planTenantSubscriptionTransition({
      current,
      action: "mark_past_due",
      effectiveAt: "2026-10-18T13:00:00.000Z",
      providerEvent: {
        provider: "example-provider",
        externalEventId: "evt-2",
        occurredAt: "2026-10-18T11:59:00.000Z",
      },
    }),
    { code: "STALE_TENANT_PROVIDER_EVENT" }
  );
});

test("entitlement resolution is disabled for suspended, cancelled and archived tenants", () => {
  assert.deepEqual(resolveTenantEntitlements(subscription({ status: "active" })), ["appointments"]);
  for (const status of ["suspended", "cancelled", "archived"]) {
    assert.deepEqual(resolveTenantEntitlements(subscription({ status })), []);
  }
});
