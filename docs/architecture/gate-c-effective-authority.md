# Gate C — Location-aware effective authority

Issue #298 implements the first additive DEV3 authorization layer on top of the trusted tenant/location contract from #279.

## Composition

The request pipeline for migrated management routes is:

`protect -> trustedTenantContextMiddleware -> effectiveAuthorityMiddleware -> requireEffectivePermissions(...)`

The resulting authority is derived from:

`authenticated User + trusted BusinessMembership role/location scope + existing StaffRole/permission catalogue`

Raw business/location values from headers, query parameters or request bodies are not authority.

## Legacy compatibility and cross-business safety

For the current canonical single-tenant case, when the trusted membership role matches the User's built-in role, existing direct User permissions and role-permission snapshots remain effective.

When the active membership role differs from the User role, those global legacy arrays are **not inherited**. The membership role is resolved through the existing StaffRole registry and only that tenant-role authority is used. This prevents a grant from one legacy/global role from silently becoming a cross-business grant.

## Scope classes

- `B` — business-wide;
- `L` — selected trusted location required;
- `A` — aggregate across allowed locations;
- `H` — hybrid business definition/location operation;
- `S` — self;
- `X` — cross-location financial/stored-value;
- `P` — reserved for explicit platform authority.

Every current employee permission is classified.

This foundation does not itself migrate domain resources. Resource ownership and domain-specific location filtering are applied when each route family is migrated.


## Operation access composition

AIIBP capability/entitlement availability remains outside the RBAC registry.

For a capability-gated management operation, the intended composition is:

`trusted tenant context -> effective user permission -> trusted capability decision -> trusted resource ownership`

DEV3 does not resolve plan entitlements or vertical capability packs. Those are trusted inputs from the platform/configuration control plane. The reusable operation-access helper only composes the decision with effective permission and optional Business/Location resource authority.

This preserves the platform rule:

`platform support AND vertical capability AND plan entitlement AND tenant configuration AND user permission AND resource ownership`

A denied capability returns a non-disclosing unavailable response. Cross-Business/cross-Location resources use the shared non-disclosing resource denial contract.


## Tenant-bound capability decisions

Effective product composition is now a merged AIIBP control-plane contract.

DEV3 consumes that composition without becoming the entitlement authority. A capability decision used by Gate C must be bound to the same trusted Business as the effective authority.

The adapter contract is:

`effective tenant product composition -> Business match -> capability state -> trusted capability decision -> operation access`

A composition for another Business fails with the same non-disclosing resource denial used for cross-tenant domain resources. Disabled or unselected capabilities fail closed as unavailable.

This prevents a valid capability state for Tenant B from being reused to authorise an operation in Tenant A.


## Workforce scope contract after #306

DEV4 #306 has merged the additive workforce ownership fields, but production route enforcement remains disabled until DEV1 completes readiness, dry-run and backfill.

DEV3 may therefore prepare the query/authority contract without activating it.

The workforce scope contract:
- always binds management queries to trusted `Stylist.business`;
- for selected-location memberships, further restricts to `Stylist.workingLocations[]` intersecting the trusted allowed-location set;
- preserves business-wide visibility for authorised all-location management;
- never uses `profilePublished`, `acceptsAppointments` or `isActive` as management-authority filters;
- uses non-disclosing resource denial for cross-Business/out-of-scope staff;
- supports a stricter selected-location assertion for location-specific workforce operations.

Live route wiring remains a separate post-backfill activation step.
