# DEV4 #387 — Tenant-owned StaffRole persistence contract

Owner: DEV4 — SaaS / multi-tenant / multi-location architecture

## Purpose

Persisted StaffRole customisation must be bounded by Business without creating a second RBAC system.

Platform-owned built-in role definitions and the canonical permission catalogue remain unchanged. BusinessMembership.roleKey remains the active tenant role selection and DEV3 remains authoritative for effective permission composition.

## Transitional model

`StaffRole.business` is additive and optional during migration.

The existing global unique `key` index remains deliberately intact until production ownership backfill and collision analysis are complete. The schema also exposes a transitional `{ business, key }` index so the target ownership shape is explicit before index cutover.

No startup migration is permitted.

## Tenant resolver

`resolveTenantStaffRole(roleKey, { businessId, activeOnly })`

The resolver:

- requires a valid trusted Business id;
- resolves platform built-in baseline definitions from code;
- reads a persisted built-in override only from that Business;
- reads a custom role only from that Business;
- never falls back to globally unowned StaffRole documents;
- never searches another Business;
- fails closed for invalid/missing Business authority.

`listTenantStaffRoleDefinitions({ businessId })` similarly returns platform built-ins plus only current-Business persisted overrides/custom roles.

## Activation sequence

1. Read-only production StaffRole ownership readiness.
2. Classify built-in override vs custom role records.
3. Prove canonical Business attribution.
4. Generate deterministic zero-write plan + fingerprint.
5. DEV1 performs guarded reviewed apply.
6. Verify zero unowned StaffRole records and no collisions.
7. DEV3 switches effective authority and `/api/staff-roles` to the Business-aware resolver/controller path.
8. Remove unsafe global User role-permission propagation.
9. Only then replace the transitional global unique key with tenant-local `{ business, key }` uniqueness.

## Guardrails

- no second permission catalogue;
- no second role system;
- no per-location role registry;
- no client Business id is authority;
- no production writes by DEV4;
- current single-tenant SalonAI behaviour remains unchanged until the controlled activation gate.
