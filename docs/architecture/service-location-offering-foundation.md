# AIIBP Service catalogue and LocationServiceOffering foundation

Issue: #287

## Scope of this slice

This is an additive architecture/test preparation slice only.

It introduces:

- transitional optional `Service.business` ownership;
- `LocationServiceOffering` as a separate operational/location record;
- a pure effective-service configuration resolver;
- field-level provenance for base-service vs location-offering values;
- fail-closed Business/Location/Service ownership checks;
- trusted platform capability gating as an input to the resolver.

It deliberately does **not** introduce:

- Service controller tenant scoping;
- public host-routing changes;
- production Service backfill;
- required `Service.business`;
- route enforcement;
- index cutover;
- production LocationServiceOffering creation;
- automatic startup migration.

Those remain gated by the #306 production workforce ownership evidence and subsequent DEV1 approval.

## Target ownership model

```
Business
  -> Service
      -> LocationServiceOffering
```

A Service is the canonical Business-owned catalogue definition.

A LocationServiceOffering describes only operational state and permitted overrides for one Location. It does not copy the Service definition.

The tuple:

```
{ business, location, service }
```

is unique.

## Location-level fields

The first contract supports:

- operational status;
- available/unavailable;
- bookable override;
- price override;
- price-label override;
- price-on-consultation override;
- duration override;
- estimated-duration override;
- publication override;
- audit metadata.

The model is intentionally extensible for future resource/room/equipment constraints.

## Effective value resolution

`resolveEffectiveServiceConfiguration()` composes:

```
Business Service definition
  -> LocationServiceOffering override
  -> trusted platform capability decision
```

The resolver does not perform RBAC or entitlement lookup itself.

DEV4 owns product/tenant composition. DEV3 remains the user/resource authority layer. Callers must provide the trusted capability decision produced by the platform composition contract.

Every effective field reports provenance, currently:

- `base-service`;
- `location-offering`;
- `platform-capability`.

## Fail-closed rules

The resolver refuses:

- Service records without trusted Business ownership;
- Service ownership belonging to another Business;
- Location offerings belonging to another Business;
- offerings for another Service;
- offerings from another trusted Location.

Ownership mismatches use non-disclosing 404-style errors.

## Publication policy

A location may always restrict publication.

A location cannot elevate a globally unpublished Service unless the caller explicitly supplies `allowLocationPublicationEnable: true`. The default is fail-closed.

## Migration boundary

Existing Salon AI Service records remain valid because `Service.business` is optional during this stage.

The production migration sequence remains:

1. complete and verify #306 production workforce ownership;
2. read-only Service readiness;
3. zero-write Service backfill plan;
4. review document counts, conflicts and fingerprint;
5. guarded Business backfill;
6. create canonical primary-location offerings only where policy requires them;
7. verify;
8. only then make Business ownership authoritative and tenant-scope routes.

No migration step runs automatically on backend startup.


## Read-only migration evidence

This preparation branch provides two commands for future DEV1-controlled evidence gathering:

```bash
npm run services:tenant-readiness
npm run services:tenant-backfill-plan
```

Neither command writes to the database.

The readiness command:
- resolves the canonical Business and active primary Location;
- proves the canonical Business is still the sole Business before any global-unowned Service assumption is allowed;
- counts unowned/already-owned/conflicting Services;
- validates any existing LocationServiceOffering ownership;
- detects missing/cross-Business Location or Service references;
- detects duplicate Business/Location/Service tuples;
- emits only counts and blocker types.

The zero-write backfill plan:
- assigns only missing `Service.business` ownership;
- reuses already-owned canonical Services;
- emits no catalogue names, Service ids or Business ids to the operator report;
- emits a deterministic SHA-256 plan fingerprint;
- includes internal rollback metadata;
- plans **zero LocationServiceOffering creations**.

The canonical Salon AI single-location migration does not need one LocationServiceOffering per Service. In the absence of an offering, the base Service remains effective at the Location. Offering records should exist only when location-specific operational state or overrides are actually required.

There is intentionally no Service backfill apply executor in this preparation PR.
