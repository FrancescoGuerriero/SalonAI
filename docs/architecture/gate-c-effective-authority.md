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
