# DEV1 — Trusted tenant resolution for AI Workforce metrics (AIIBP v3)

Status: source-only, internal, not activated in production. Owner: DEV1.

## Canonical architecture

`aiWorkforceTrustedTenantResolver.js` links existing authorities; it does
not introduce a duplicate entitlement, tenant registry or AI execution engine.

The resolver loads `TenantProductManifest` and `TenantSubscription` by the
Business ID established by the trusted effective-authority middleware.
It verifies returned record ownership, active manifest status, the persisted
manifest SHA-256 integrity hash, effective date, registered subscription plan,
plan consistency and subscription lifecycle.

`resolveTenantEntitlements` derives grants exclusively from the persisted
subscription, and `validateTenantProductManifestForActivation` composes
versioned capability packs. The resolver requires an explicit `ai` grant,
intersects registered capability-pack keys with granted entitlements and fails
closed for missing/corrupt/foreign/suspended records. Unregistered feature
grants are not treated as capabilities.

`invokeMetricsWithResolvedTenantAuthority` is an internal service-only
bridge into the existing audited `invokeGovernedBusinessMetrics`.
Effective authority and user identity must come from trusted backend
middleware, not a model, prompt, provider callback or HTTP body.

## Security boundaries

- No fallback to a permissive/default tenant composition.
- No client-supplied `composition` or `enabledEntitlements` argument.
- The invoked tool independently rechecks `ai:use`, `appointment:read`,
  authorised location, A0 autonomy and the current canonical evidence scope.
- No agent mutation, customer messaging, purchases, arbitrary code execution,
  external publishing or model invocation.
- No route or feature toggle is enabled by this implementation.
- Existing subscription lifecycle's entitlement semantics apply, including
  permitted trial/active/past-due states. Tighten grace handling separately
  before live billing enforcement.

## Acceptance and later work

The tests simulate authoritative MongoDB query boundaries and cover valid
scope, missing/foreign records, corrupt hash, suspended subscriptions,
missing AI grants, mismatched plans, future effective dates, and denied
cross-location invocation.

Before activation: database-backed isolation test environment; live
subscription/provider state validation; feature-flag/platform safety-lock
integration; measured invocation timeouts, run/audit reconciliation, metric
value and per-metric permission validation, deployment review.

Do not deploy or activate through this PR.
