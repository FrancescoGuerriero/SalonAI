# Trusted tenant and location authority contract

Roadmap v3.0 issue #279 publishes the control-plane contract that DEV3 location-aware RBAC should consume.

## Authority composition

The canonical future authorization flow is:

`authenticated User + trusted BusinessMembership + allowed Location scope + current permission + capability/entitlement + resource ownership`

DEV4 supplies only the trusted Business/Location boundary. DEV3 remains responsible for composing the existing permission catalogue and StaffRole registry into effective authority.

## BusinessMembership

`BusinessMembership.roleKey` is a tenant-local role key compatible with the existing role/StaffRole naming convention. It is **not** a second permission registry and must not carry duplicate permission arrays.

The membership supplies:
- authenticated user binding;
- Business binding;
- active/suspended/revoked status;
- roleKey;
- location access mode;
- explicitly allowed locations when mode is `selected`;
- optional default-membership selection.

## Trusted tenant context

A resolved tenant context has this shape:

```js
{
  userId,
  businessId,
  locationId,          // null for business/aggregate context
  roleKey,
  locationAccessMode,  // "all" | "selected"
  allowedLocationIds   // null when mode === "all", otherwise trusted ids
}
```

Interpretation:
- `locationAccessMode: "all"` means all eligible locations inside the already trusted Business boundary; it never means cross-business access.
- `locationAccessMode: "selected"` means the caller is limited to `allowedLocationIds`.
- `locationId` is the selected operational location for L-scoped work and may be null for B/A-scoped work.
- every referenced Location must belong to `businessId`.

## Request selection

The default DEV4 middleware reads only `request.trustedTenantSelection`.

Raw client headers, query parameters and request-body fields are ignored by default. A future location switcher may introduce a selector, but that selector must be verified through `resolveTrustedTenantContext` before it becomes authority.

Therefore:

`client selection != authorization`

## DEV3 integration rules

DEV3 should:
1. run authentication first;
2. resolve trusted tenant/location context;
3. calculate effective permissions from the current permission/StaffRole system;
4. apply scope classification (B/L/A/H/X/etc.);
5. verify target resource ownership;
6. fail closed when required location authority is absent.

DEV3 should not:
- create another BusinessMembership model;
- create another Location model;
- copy permissions into BusinessMembership;
- treat `roleKey` as sufficient authorization;
- infer location access from a permission alone;
- trust browser-supplied business/location identifiers without membership verification.

## Aggregate scope

For A-scoped operations:
- selected-mode memberships may aggregate only `allowedLocationIds`;
- all-mode memberships may aggregate eligible locations belonging to the active Business;
- cross-business aggregation requires a later explicit platform/organisation authority contract.

## Single-location compatibility

Current Salon AI can continue operating with one canonical Business and one canonical Location during migration. This preserves existing behavior while enabling the same authority contract to scale to multi-location tenants later.
