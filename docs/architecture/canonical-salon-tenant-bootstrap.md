# Canonical Salon AI tenant bootstrap

Issues: #289, #291  
Owner: DEV4  
Production apply authority: DEV1

## Purpose

This bootstrap creates or verifies the control-plane records required before production domain collections can become tenant/location aware:

1. one canonical Salon AI `Business` tenant;
2. one canonical primary `Location`;
3. one primary `BusinessDomain`;
4. one current application-domain `BusinessDomain`.

The reference tenant is **Francesco Picardi**. **Salon AI** is the vertical, not the tenant.

Reference routing defaults used for dry-run previews:

- Business: `Francesco Picardi`;
- Business slug: `francesco-picardi`;
- primary domain: `francescopicardi.co.uk`;
- application domain: `salonai.francescopicardi.co.uk`.

It does **not** backfill Services, staff, customers, appointments, commerce, communications, analytics or AI collections. It does not make DNS changes.

## Configuration

Dry-run may use development-safe defaults for previewing the plan.

Production `--apply` requires these six values to be explicitly configured by the operator:

- `SALONAI_CANONICAL_BUSINESS_NAME`
- `SALONAI_CANONICAL_BUSINESS_SLUG`
- `SALONAI_CANONICAL_LOCATION_NAME`
- `SALONAI_CANONICAL_LOCATION_SLUG`
- `SALONAI_CANONICAL_PRIMARY_DOMAIN`
- `SALONAI_CANONICAL_APP_DOMAIN`

Optional inherited business settings:

- `SALONAI_CANONICAL_TIMEZONE` (default `Europe/London`)
- `SALONAI_CANONICAL_LOCALE` (default `en-GB`)
- `SALONAI_CANONICAL_CURRENCY` (default `GBP`)

Do not infer production identity from Figma examples, browser input or untrusted request values. Apply mode validates all six explicit identity values before connecting the creation path.

## Dry-run

From the backend container/worktree:

```bash
npm run tenant:bootstrap:salon
```

Dry-run is the default. It reports whether the canonical Business, Location and domain records would be created or reused and performs no writes.

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

Apply mode also requires all six canonical identity environment variables above.

Business, Location and any missing BusinessDomain records are created in one MongoDB transaction. A downstream creation failure must not leave a partially-created reference tenant.

New domain records are created with status **`pending`**. Bootstrap never activates a public domain, changes DNS or treats domain creation as verification.

## Verification

After apply:

```bash
npm run tenant:bootstrap:salon -- --verify
```

Verification is read-only and requires the canonical Business, Location and both configured domain records to be present and ownership-compatible. It does not require the domain records to be publicly active.

## Conflict policy

The operation fails closed if:

- more than one Business matches the approved name/slug;
- the matching Business belongs to a non-Salon vertical;
- the existing Business name or slug differs from approved configuration;
- more than one Location in that Business matches the approved name/slug;
- the Location belongs to another Business;
- the existing Location name or slug differs from approved configuration;
- either configured domain already belongs to another Business;
- an existing domain has an incompatible role;
- primary and application domains resolve to the same host.

No existing tenant/location/domain record is silently renamed or reassigned.

## Rollback evidence

Apply output records only resources created by that invocation.

Safe removal order for newly-created resources is:

1. BusinessDomain records created by the invocation;
2. Location;
3. Business.

Reused pre-existing resources are never included in rollback removal metadata.

Rollback is not executed automatically; DEV1 must review production dependencies before any removal.

## Host-routing security

BusinessDomain is a **public routing selector**, not authenticated management authority.

- public host -> Business resolution is server-side;
- raw client `businessId` values never grant public tenant authority;
- `X-Forwarded-Host` is ignored unless the server's trusted proxy boundary explicitly enables it;
- pending, disabled or unknown domains fail closed;
- management/staff operations still require authenticated BusinessMembership/effective-authority checks.

## Next gates

After #291 is merged and the canonical tenant is approved through DEV1:

- #306 — workforce Business/Location ownership and BusinessMembership migration;
- #287 — business-owned Service catalogue + LocationServiceOffering.

These migrations remain dry-run-first and must not overlap.

#309 report/export aggregation consumes ownership contracts as their underlying source domains become tenant-aware.
