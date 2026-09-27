# AI Intelligent Business Platform — SaaS / Multi-Vertical Architecture

## Product hierarchy

**AI Intelligent Business Platform** is the shared SaaS platform.

The platform is organised into vertical products and independent customer tenants.

Current vertical products are:

1. **Salon AI** — the first/reference vertical.
2. **Spa AI** — later spa vertical.
3. **Plastic Surgery AI** — later clinical/surgical vertical.
4. **Fitness AI** — later fitness/performance vertical.

The first SaaS acceptance sequence is intentionally within Salon AI:

1. **Tenant 1 — Francesco Picardi** — reference tenant; primary domain `francescopicardi.co.uk`, with the current application host `salonai.francescopicardi.co.uk`.
2. **Tenant 2 — second independent salon** — future SaaS acceptance tenant used to prove that onboarding does not require a code fork.

Only after two independent Salon AI tenants operate correctly should the platform activate Spa AI or another second vertical.

Salon AI is the application currently used to build and prove shared capabilities. Features that are genuinely reusable should move downward into AI Intelligent Business Platform rather than remaining salon-specific. Salon-specific behaviour stays in the Salon AI vertical.

This relationship is:

```text
AI Intelligent Business Platform
|
+-- Shared platform core
|   +-- Identity and tenancy
|   +-- Booking/scheduling primitives
|   +-- CRM/customer management
|   +-- Commerce/payments
|   +-- Communications
|   +-- Calendar integrations
|   +-- Analytics
|   +-- AI infrastructure and governance
|   +-- Feature entitlements
|   +-- Audit/security
|
+-- Salon AI                 <- reference vertical
|   +-- Tenant 1: Francesco Picardi
|   +-- Tenant 2: future independent salon
|
+-- Spa AI
+-- Plastic Surgery AI
+-- Fitness AI
```

The platform may later support additional vertical products without cloning the codebase.

## Architectural rule

Shared functionality belongs to AI Intelligent Business Platform. Industry-specific behaviour belongs to a vertical module. Tenant-specific data is always scoped to one Business id.

The target layering is:

1. **AI Intelligent Business Platform core** — identity, tenancy, booking primitives, commerce, communications, calendar, analytics, feature controls, audit and AI infrastructure.
2. **Vertical modules** — terminology, workflows, validation, policy and optional domain metadata for Salon AI, Plastic Surgery AI, Spa AI, Fitness AI and later products.
3. **Tenant configuration** — branding, locale, subscription, enabled capabilities, locations and tenant data.
4. **Product applications** — separately branded customer/staff experiences composed from the same shared platform.

## Salon AI's role

Salon AI is not a separate fork of the platform. It is the first and primary implementation used to develop shared platform capabilities.

When Developer 1 adds functionality to Salon AI, Developer 4 evaluates whether the capability is:

- **platform-generic** — suitable for extraction into AI Intelligent Business Platform;
- **vertical-generic** — reusable within appointment/service businesses but needing vertical configuration;
- **Salon AI-specific** — kept in the salon vertical.

This allows current Salon AI development to continue while the reusable platform grows beneath it.

## Current vertical registry

Stable vertical ids:

| Product | Vertical id | Primary terminology |
| --- | --- | --- |
| Salon AI | `salon` | Salon / Stylist / Service / Appointment / Customer |
| Plastic Surgery AI | `plastic-surgery` | Plastic Surgery Clinic / Practitioner / Procedure / Consultation / Patient |
| Spa AI | `spa` | Spa / Therapist / Treatment / Appointment / Client |
| Fitness AI | `fitness` | Fitness Business / Trainer / Session / Booking / Member |

The terminology layer is presentation/domain configuration. Shared persistence and service contracts should continue to use generic platform concepts where practical.

Plastic Surgery AI will require additional healthcare-specific privacy, consent, governance and regulatory design before clinical or patient-facing AI capabilities are activated. Those requirements must not be inferred from Salon AI defaults.

## Developer 4 ownership

Developer 4 owns the AI Intelligent Business Platform extraction lane:

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
- `verticalRegistry` registers Salon AI, Plastic Surgery AI, Spa AI and Fitness AI.
- `tenantScope` provides fail-closed query/document scoping helpers.
- `getRuntimePlatformConfiguration()` exposes safe platform and current-product metadata.
- Salon AI remains the default/reference vertical for backwards compatibility.
- Existing production collections are not tenant-migrated by this increment.

## Tenant migration sequence

### Stage A — platform foundation

Add the tenant root, four-product vertical registry, scoping primitives and tests without changing current production queries.

### Stage B — trusted identity binding

Add Business membership or equivalent tenant-aware identity binding. Authentication must derive the active tenant from trusted server-side membership/session state, never from an arbitrary client-supplied id.

### Stage C — reference Salon AI tenant bootstrap

Create the canonical **Francesco Picardi** Business record, primary Location and trusted BusinessDomain mappings. Salon AI remains the vertical; Francesco Picardi is the first tenant.

Reference routing:
- primary tenant domain: `francescopicardi.co.uk`;
- current application domain: `salonai.francescopicardi.co.uk`.

Domain mappings begin pending until separately verified/activated. Existing production data is associated with the Francesco Picardi tenant only through controlled migration batches.

### Stage D — domain model migration

Migrate collections in controlled groups. Each tenant-owned document receives a required `business` reference and tenant-local uniqueness becomes a compound index.

Recommended order:

1. services/catalogue;
2. staff/stylists and schedules;
3. customers/profiles;
4. appointments;
5. communications;
6. commerce/inventory;
7. analytics/AI evidence.

Each group requires data backfill and cross-tenant isolation tests before production activation.

### Stage E — tenant-aware entitlements

Move appropriate global feature flags to tenant-scoped subscription/entitlement configuration while preserving platform-level safety and emergency controls.

### Stage F — second Salon AI tenant

Provision a second independent salon Business against the same Salon AI vertical without copying code, repositories or shared data. This is the first real SaaS acceptance test.

Success requires tenant-specific:
- domain/host routing;
- locations;
- branding/configuration;
- staff and permissions;
- services/catalogue;
- customer/booking data;
- integrations and AI knowledge.

### Stage G — second vertical activation

After two Salon AI tenants prove multi-tenancy, activate **Spa AI** (or another agreed second vertical) against the same platform core without copying Salon AI. This is the multi-vertical acceptance test.

### Stage H — further verticals and package extraction

Add later verticals such as Plastic Surgery AI and Fitness AI through vertical modules, capability packs and configuration. Extract stable shared packages only after tenant and vertical boundaries have been proven in production-like use.

## Security requirements

- A tenant id supplied only by request headers/query/body is never sufficient authorization.
- Tenant context must come from authenticated membership, trusted host mapping or another server-controlled binding.
- Every tenant-owned read, update and delete must include tenant scope in the database query itself.
- Cross-tenant misses should normally return 404 semantics to avoid resource-existence leakage.
- Tenant-local unique indexes must include `business`.
- Background jobs, webhooks, AI retrieval and analytics must carry the same tenant context as interactive requests.
- AI training/evidence stores must preserve tenant provenance and permission boundaries.
- Vertical-specific regulatory requirements must be applied in addition to the shared platform security baseline.

## Compatibility

This increment remains intentionally non-breaking:

- no existing route is removed;
- no existing production collection gains a required tenant field yet;
- no production data migration runs;
- no deployment workflow changes;
- no frontend surface changes.

Developer 1 can therefore continue Salon AI development while Developer 4 grows AI Intelligent Business Platform underneath it.
