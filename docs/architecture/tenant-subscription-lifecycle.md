# Tenant subscription, plan and lifecycle foundation

Status: **implemented platform foundation** for issue #444.

## Purpose

The subscription control plane is distinct from:

- `TenantProductManifest` product composition;
- feature flags;
- tenant configuration/branding;
- DEV3 RBAC/effective authority;
- external billing-provider state.

A billing provider can supply events, but it is never the tenant identity or permission authority.

## Canonical record

`TenantSubscription` stores one canonical subscription snapshot per Business:

- Business ownership;
- registered plan key and version;
- lifecycle state;
- explicit entitlement grants and optional limits;
- lifecycle revision;
- provider-neutral billing binding;
- trial/current-period/grace/suspension/cancellation/archive timestamps;
- last reviewed transition fingerprint;
- embedded lifecycle audit history.

The existing embedded `Business.subscription` object remains a compatibility surface only. New lifecycle behaviour should consume `TenantSubscription`.

## Lifecycle

Supported states are:

`provisioning -> trial -> active -> past_due -> suspended -> cancelled -> archived`

The transition graph is explicit and fail-closed. Important rules:

- suspended can be explicitly reactivated;
- cancelled cannot be silently reactivated;
- archived is terminal;
- plan changes do not silently alter RBAC;
- stale or duplicate provider events fail closed;
- suspended/cancelled/archived subscriptions expose no active entitlement set.

## Plans and entitlements

The plan registry is platform-owned code. It currently registers plan identities already used by product-composition contracts (`standard`, `ai-business`) without inventing prices or provider-specific commercial policy.

Entitlements are explicit grants on the subscription snapshot. This keeps these concepts separate:

`plan != entitlement != feature flag != configuration != permission`

Pricing, tax, invoice policy and provider-specific checkout remain outside this foundation.

## Provider boundary

Provider bindings may hold opaque customer/subscription references and the latest provider event identity, but never API keys, signing secrets or credentials.

Provider events must:

1. identify provider + external event id + occurrence time;
2. be newer than the last applied provider event;
3. pass the canonical transition graph;
4. produce a deterministic reviewed transition fingerprint;
5. be appended to lifecycle audit history when applied.

## Relationship to tenant product manifests

A plan change may lead to a separately reviewed `TenantProductManifest` revision through the existing product-composition upgrade path. The subscription lifecycle never directly mutates product composition or RBAC.

## Acceptance covered by source tests

- deterministic transitions and fingerprints;
- invalid transition rejection;
- suspension/reactivation;
- cancellation fail-closed behaviour;
- deterministic plan changes;
- duplicate/stale provider-event rejection;
- entitlement disabling for suspended/cancelled/archived tenants;
- registered plan validation.

No Stripe subscription is created and no production tenant lifecycle state is mutated by this foundation.
