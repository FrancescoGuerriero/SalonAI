# SalonAI SaaS / Multi-Vertical Platform Architecture

## Purpose

SalonAI remains the first production vertical while the codebase evolves into a reusable SaaS platform. The platform must support multiple independent businesses (tenants) and multiple business verticals without cloning the application into divergent repositories.

## Architectural rule

Shared functionality belongs to the platform. Industry-specific behaviour belongs to a vertical module. Tenant-specific data is always scoped to one Business id.

The target layering is:

1. **Platform core** — identity, tenancy, booking primitives, commerce, communications, calendar, analytics, feature controls, audit and AI infrastructure.
2. **Vertical modules** — terminology, workflows, validation and optional domain metadata for salon, barbering, spa, clinic, fitness or later verticals.
3. **Tenant configuration** — branding, locale, subscription, enabled capabilities, locations and tenant data.
4. **Applications** — separately branded customer/staff experiences composed from the same platform packages.

## Developer 4 ownership

Developer 4 owns the SaaS/platform extraction lane:

- Business/tenant root model and tenant-isolation primitives.
- Vertical registry and business-type contracts.
- Migration of generic data models to tenant-aware schemas.
- Platform configuration and capability composition.
- Subscription/entitlement foundation where it does not conflict with commerce checkout.
- Multi-vertical package boundaries and later monorepo extraction.
- Cross-tenant isolation tests and migration tooling.

Developer 4 does **not** merge or deploy independently. Developer 1 remains application/integration/release lead.

## Non-conflict rule

While Developer 1/2/3 have active work, Developer 4 should prefer additive platform files. Existing shared models are migrated only after the relevant active PRs have landed or Developer 1 confirms a safe integration window.

## Foundation introduced in this increment

- `Business` is the future tenant root.
- `verticalRegistry` defines the current Salon vertical and provides an explicit registration point for later verticals.
- `tenantScope` provides fail-closed query/document scoping helpers.
- `getRuntimePlatformConfiguration()` exposes safe vertical metadata.
- The current application remains single-vertical and behaviour-compatible. No existing collection is tenant-migrated by this increment.

## Tenant migration sequence

### Stage A — foundation (current)

No current production queries change. Add the root tenant model, registry, scoping primitives and tests.

### Stage B — identity binding

Add a Business membership model or tenant-aware identity binding. Authentication must derive the active tenant from trusted server-side membership/session state, never from an arbitrary client-supplied id.

### Stage C — model migration

Migrate domain collections in controlled groups. Each migrated document gets a required `business` reference and compound indexes that include the tenant key where uniqueness is tenant-local.

Recommended order:

1. services/catalogue;
2. staff/stylists and schedules;
3. customers/profiles;
4. appointments;
5. communications;
6. commerce/inventory;
7. analytics/AI evidence.

Each group requires a backfill migration for the current SalonAI business plus isolation regression tests before production activation.

### Stage D — tenant-aware feature controls

Move global `SystemSetting` feature flags to tenant-scoped entitlements/configuration while preserving required controls and platform-level emergency controls.

### Stage E — second vertical

Build the second vertical using the registry and shared modules without copying the SalonAI codebase. This is the architectural acceptance test: if significant application code must be duplicated, platform boundaries are not yet correct.

### Stage F — package/monorepo extraction

After two verticals prove the boundaries, extract stable shared modules into packages/apps. Do not force a large monorepo rewrite before the abstractions are proven.

## Security requirements

- A tenant id supplied only by request headers/query/body is never sufficient authorization.
- Tenant context must be derived from authenticated membership, trusted host mapping or another server-controlled binding.
- Every tenant-owned read, update and delete must include tenant scope in the database query itself.
- Cross-tenant misses should normally return 404 semantics to avoid leaking resource existence.
- Unique indexes that are logically tenant-local must become compound indexes with `business`.
- Background jobs, webhooks, AI retrieval and analytics must carry the same tenant context as interactive requests.
- AI training/evidence stores must preserve tenant provenance and permission boundaries.

## Vertical registry policy

Only the current `salon` vertical is registered today. The remaining five business types should be registered when their product requirements are chosen rather than guessed in infrastructure code. The registry is intentionally extensible so adding a vertical does not require rewriting shared services.

## Compatibility

This increment is intentionally non-breaking:

- no existing route is removed;
- no existing model gains a required tenant field yet;
- no production data migration runs;
- no deployment workflow changes;
- no frontend surface changes.

This allows Developer 1 to continue current feature development while the SaaS foundation evolves independently.
