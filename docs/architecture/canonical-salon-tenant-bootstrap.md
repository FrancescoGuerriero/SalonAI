# Canonical SalonAI Business/Location bootstrap

Issue: #289  
Owner: DEV4  
Production apply authority: DEV1

## Purpose

This bootstrap creates or verifies the two control-plane records required before production domain collections can become tenant/location aware:

1. one canonical SalonAI `Business`;
2. one canonical primary `Location`.

It does **not** backfill Services, staff, customers, appointments, commerce, communications, analytics or AI collections.

## Configuration

Dry-run may use the development-safe defaults for previewing the plan.

Production `--apply` requires these four values to be explicitly configured by the operator:

- `SALONAI_CANONICAL_BUSINESS_NAME`
- `SALONAI_CANONICAL_BUSINESS_SLUG`
- `SALONAI_CANONICAL_LOCATION_NAME`
- `SALONAI_CANONICAL_LOCATION_SLUG`

Optional inherited business settings:

- `SALONAI_CANONICAL_TIMEZONE` (default `Europe/London`)
- `SALONAI_CANONICAL_LOCALE` (default `en-GB`)
- `SALONAI_CANONICAL_CURRENCY` (default `GBP`)

Do not infer a production location identity from Figma examples, developer memory or arbitrary browser input.

## Dry-run

From the backend container/worktree:

```bash
npm run tenant:bootstrap:salon
```

Dry-run is the default. It reports whether the canonical Business and Location would be created or reused and performs no writes.

## Migration readiness

Read-only repository-wide count/index evidence:

```bash
npm run tenant:migration-readiness
```

Or limit the evidence to specific collections:

```bash
npm run tenant:migration-readiness -- \
  --collection=services \
  --collection=stylists \
  --collection=customers \
  --collection=appointments
```

The readiness command rejects write/apply/migrate arguments.

## Apply gate

Do not run from CI.

After DEV1 reviews the dry-run/readiness evidence and explicitly approves the configured identity:

```bash
SALONAI_TENANT_BOOTSTRAP_CONFIRM=BOOTSTRAP_CANONICAL_SALONAI_TENANT \
npm run tenant:bootstrap:salon -- --apply
```

Apply mode also requires all four canonical identity environment variables above.

The Business and Location creations run in one MongoDB transaction. A Location creation failure therefore cannot leave a newly-created canonical Business committed on its own.

## Verification

After apply:

```bash
npm run tenant:bootstrap:salon -- --verify
```

Verification is read-only and requires both canonical resources to be present and compatible.

## Conflict policy

The operation fails closed if:

- more than one Business matches the configured canonical name/slug;
- the matching Business belongs to a non-Salon vertical;
- the existing Business name or slug differs from the approved configuration;
- more than one Location in that Business matches the configured name/slug;
- the Location belongs to another Business;
- the existing Location name or slug differs from the approved configuration.

No existing tenant/location record is silently renamed by bootstrap.

## Rollback evidence

Apply output records only resources created by that invocation.

Safe removal order for a newly-created pair is:

1. Location;
2. Business.

Reused pre-existing resources are never included in rollback removal metadata.

Rollback is not executed automatically; DEV1 must review production dependencies before any removal.

## Next gate

Issue #287 remains blocked until:

- canonical Business/Location records are created and verified;
- DEV1 accepts bootstrap evidence;
- DEV3 trusted membership/RBAC composition is available before location-aware route enforcement goes live.

Service/catalogue migration must remain a separate dry-run-first increment.
