# Configuration inheritance control plane

Roadmap v3.0 issue #279 defines effective configuration as:

`platform safety defaults -> vertical defaults -> business -> region/zone -> location -> permitted local override`

This document describes the additive control-plane contract. It does not replace the existing SystemSetting feature controls or migrate production configuration.

## Layer contract

Each layer may provide:
- `scope`: stable provenance label;
- `revision`: immutable configuration revision identifier;
- `values`: configuration values introduced or overridden by the layer;
- `locks`: paths that lower-precedence layers cannot override;
- `allowedPaths`: allow-list of paths this layer may change;
- `requiredEntitlements`: path-to-capability/entitlement requirements.

The resolver returns:
- effective `value`;
- per-path `provenance`;
- detailed provenance with revision;
- active locks and lock owners;
- blocked override evidence;
- the ordered revisions that produced the result.

## Safety semantics

A lower layer cannot override a locked parent or child path. A layer with `allowedPaths` cannot write outside its permitted area. A value that requires an unavailable capability/entitlement is ignored and recorded as a blocked override.

Blocked configuration is evidence, not a silent success. This is important for operator diagnostics and future Configuration Studio UX.

## Versioning and rollback

Persisted configuration should use immutable revisions plus a mutable pointer to the active revision. Rollback changes the active pointer to a known prior revision; it does not rewrite historical revisions.

A future persisted configuration revision should include:
- tenant/business;
- optional region/zone/location scope;
- revision id;
- parent/superseded revision;
- values/locks/policy;
- createdBy;
- createdAt;
- approval/audit metadata.

The current resolver already accepts revision identifiers so provenance remains compatible with that future storage model.

## Capability integration

Entitlements and capabilities are inputs to effective configuration, not permissions by themselves. Final runtime access remains layered:

`platform support AND vertical capability AND plan entitlement AND tenant configuration AND user permission AND regulatory rule`.

DEV3 RBAC remains the user-authority layer. DEV4 configuration inheritance supplies tenant/location configuration and provenance.

## Progressive hierarchy

Small tenants are not required to use Brand, Region/Zone or Business Unit. Omitted layers simply do not participate in resolution. This avoids forcing enterprise hierarchy onto single-location customers.

## Production migration rule

Do not auto-migrate existing SystemSetting data on application startup. Introduce persisted configuration revisions only after:
- the trusted tenant/location context is integrated;
- ownership of current feature controls is mapped;
- a dry-run migration report is available;
- rollback is tested;
- DEV1 accepts the integration boundary.
