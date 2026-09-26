# Trusted tenant/location RBAC composition

Issue: #290  
Owner: DEV3  
Dependencies: merged #279/#283, merged #278/#285

## Purpose

This increment composes the existing SalonAI permission system with the trusted multi-tenant control plane without creating a second RBAC registry.

The runtime authority sequence is:

`authenticated User -> trusted BusinessMembership/Location context -> existing permission calculation -> resource/query scope`

## Role authority

`tenantContext.roleKey` is the trusted tenant-local role selector because it comes from persisted `BusinessMembership` after authentication.

The existing `permissionsForRole()` function remains the permission catalogue/baseline authority.

During the current single-tenant migration, direct `User.permissions` and `User.rolePermissions` are reused only when:

`User.role === tenantContext.roleKey`

If the roles differ, the permission arrays are not reused. This prevents legacy grants from one context silently widening authority in another tenant.

A future staff/role migration may replace those legacy arrays with explicit tenant-local role grants. This increment intentionally fails closed until that migration exists.

## Scope types

### Business

Use only for domains explicitly classified as tenant-wide.

Filter:

```text
business = active trusted Business
```

### Location

Use for operational resources such as appointments, location inventory or schedules once those domains are migrated.

Filter:

```text
business = active trusted Business
location = active trusted Location
```

A location-scoped operation fails closed if no trusted active Location is selected.

### Aggregate

Used for authorised cross-location reporting/queries.

- `locationAccessMode=all`: Business scope only.
- `locationAccessMode=selected`: query receives `location: { $in: allowedLocationIds }`.

An empty selected allow-list therefore returns no location records.

### Self

Self-service targets are checked against `tenantContext.userId`.

## Resource ownership

Direct resource access verifies ownership after retrieval and must return 404-style semantics when the target is outside the trusted Business/Location.

This prevents resource-existence disclosure across tenants.

## Caller filters

For location-scoped and selected aggregate queries, caller-provided `location` criteria are rejected.

The scope filter is derived from trusted authority, not from query/body/header values.

`client selection != authorization`

## Middleware composition

Future route integration order:

1. existing authentication;
2. DEV4 trusted tenant context middleware;
3. DEV3 tenant-aware permission middleware;
4. tenant/location criteria included in the database query;
5. resource ownership check where direct-id access requires it;
6. audit evidence for authority-changing operations.

Navigation visibility remains presentation only.

## AI boundary

An `ai:use` permission does not widen record scope.

AI context retrieval and tool execution must use the same business/location filters as the source domain.

## This PR intentionally does not

- add a second StaffRole/permission model;
- tenant-migrate StaffRole;
- backfill BusinessMembership records;
- wire every route at once;
- migrate Service, Customer, Appointment, Staff or commerce collections;
- trust browser-supplied Business/Location ids;
- change production data.

## Next integration pattern

After this guard merges, domain integration should proceed through small PRs.

Each domain PR must identify whether its operations are:
- business;
- location;
- aggregate;
- self.

Do not combine the whole repository into one RBAC migration.
