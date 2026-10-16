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

## Migration commands

Read-only readiness:

`npm run staff-roles:tenant-readiness`

Deterministic zero-write plan:

`npm run staff-roles:tenant-backfill-plan`

DEV1-controlled guarded apply:

`STAFF_ROLE_TENANT_BACKFILL_CONFIRM=APPLY_STAFF_ROLE_TENANT_BACKFILL STAFF_ROLE_TENANT_BACKFILL_PLAN_FINGERPRINT=<reviewed-sha256> npm run staff-roles:tenant-backfill -- --apply`

The apply executor is migration tooling, not production authority. It requires the shared explicit canonical tenant identity, recomputes the reviewed plan before writes, verifies the fingerprint again inside a transaction, updates only records that remain unowned, and performs a zero-unowned postflight.

## Activation sequence

1. Merge additive ownership/resolver/migration tooling.
2. Run read-only production StaffRole ownership readiness.
3. Classify built-in override vs custom role records.
4. Prove canonical Business attribution.
5. Generate deterministic zero-write plan + fingerprint.
6. Execute the guarded reviewed apply under production release authority.
7. Verify zero unowned StaffRole records and no collisions.
8. DEV3 switches effective authority and `/api/staff-roles` to the Business-aware resolver/controller path.
9. Remove unsafe global User role-permission propagation.
10. Only then replace the transitional global unique key with tenant-local `{ business, key }` uniqueness.

## Current implementation state

This refreshed implementation is based directly on current `main` after repository dependency-security remediation. It carries only the additive StaffRole ownership contract, tenant resolver, readiness/planning tooling, guarded transactional apply executor and focused regression coverage.

## Guardrails

- no second permission catalogue;
- no second role system;
- no per-location role registry;
- no client Business id is authority;
- no automatic production migration;
- current single-tenant SalonAI behaviour remains unchanged until the controlled activation gate.
