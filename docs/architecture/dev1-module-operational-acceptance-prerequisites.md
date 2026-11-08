# DEV1 — Module-specific operational acceptance prerequisites

Status: read-only development slice. No production deployment, approval, entitlement
mutation, module activation, autonomous AI operation or monthly AI quota.

The Module Management dashboard can now inspect a business-wide assessment
through `GET /api/system-administration/module-catalogue/operational-acceptance`.
It reuses `inspectTrustedTenantModuleEvidence`, which resolves effective
authority from trusted server context, verifies manifest/subscription ownership
and integrity, enforces `feature-control:read`, and denies selected-location
staff access to business-wide subscription data.

## Assessment contract

All 27 requirements and 21 candidates are assessed. Each entry identifies
canonical capability mappings, registered dependency keys, and registered
permission definitions. Criteria distinguish:

- `evidence_present`: a specific server-derived prerequisite is known.
- `failed_or_missing`: a prerequisite is explicitly denied/missing.
- `not_verified`: the necessary acceptance evidence has not been collected.

The server-derived prerequisite checks cover canonical registration, persisted
tenant records, manifest composition, subscription grants and eligible
subscription lifecycle. These are **prerequisites**, not production acceptance.

Additional criteria explicitly remain **not verified**: dependency activation,
positive/negative effective permission tests, database-backed tenant/location
isolation, module-specific API/workflow tests, provider readiness, current
deployment and runtime identity, and independently authorised production
sign-off. Candidate requirements without registered capability mappings are
not presented as deployed features.

Every result retains `readyForProductionAcceptance: false`,
`productionAccepted: null` and `activationAuthorised: false` until a
separate signed-off acceptance workflow is designed, implemented, reviewed
and independently verified. The dashboard provides no approval or activation
buttons. The endpoint is GET-only.

## Further acceptance work

1. Build tenant- and location-owned module API test fixtures with real MongoDB
   reads and negative permissions.
2. Add provider-specific readiness checks where integrations are relevant,
   using existing configuration, callback and event reconciliation controls.
3. Correlate a trusted current deployment identity with tenant/vertical
   configuration and named module API acceptance evidence.
4. Specify explicit authorised production acceptance roles, expiry, revocation,
   evidence provenance and audit trail before any sign-off operations.

DEV1 is the sole development owner.
