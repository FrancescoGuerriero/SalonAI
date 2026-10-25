# Stage 8B — Location-owned Campaign, Social and Reputation Hub completion

## Status

Implementation tranche complete on the DEV1 branch. This document records the intended source contract; it does **not** perform a production migration, backfill, provider activation, deployment or cross-location data reassignment.

## Product rule

SALON AI may define reusable campaign strategy at Business level, but operational marketing truth belongs to the selected Location. Cross-location reporting is an authorised aggregation concern and must not be implemented by silently querying or mutating operational rows across locations.

## Completed 8B contracts

### 1. Master campaign vs location execution state

`Campaign` remains the business-owned reusable definition: name, objective, channels, audience definition, copy/template and UTM identity.

`CampaignLocationState` now owns the operational schedule/cancellation state per Location. Scheduling or cancelling one location no longer overwrites the master campaign lifecycle for every location.

Scheduled communication jobs carry both `business` and `location` and are queried, replaced and cancelled only inside the selected location.

### 2. Cross-channel execution ownership

`CampaignExecution` requires Location ownership. Its idempotency boundary is now `business + location + idempotencyKey`.

Provider executions can therefore use the same master campaign safely in separate locations without sharing execution identity or performance state.

### 3. Social publishing ownership

`SocialPublication` requires Location ownership. Create, list, queue and publish operations require trusted effective location authority.

The background social publishing worker propagates the publication's stored Location into the publishing service. Legacy publications without authoritative Location fail closed rather than being guessed or auto-assigned.

Live social publication remains gated by `SOCIAL_PUBLISHING_LIVE_ENABLED`; this tranche does not activate providers.

### 4. Deterministic attribution ownership

`AttributionTouch` requires Location ownership and remains append-only.

Lead and Opportunity attribution subjects are verified against `business + location`. Source-key deduplication is location-scoped. Lead capture, opportunity and conversion attribution receive trusted location authority from the CRM controller.

The canonical Customer identity remains business-owned under the existing CRM identity boundary; 8B does not split Customer identity by location.

### 5. Campaign performance ownership

Campaign performance now blends only evidence owned by the selected Location:

- `CampaignExecution` rows for the location;
- `AttributionTouch` rows for the location;
- Stage-5 `MarketingNormalisedRecord` rows for the location.

The existing deterministic non-double-counting rule remains: CampaignExecution is primary per provider/metric and Stage-5 normalised marketing data is fallback evidence only where the provider has no non-zero primary value.

### 6. Reputation hub ownership

`ExternalReview` and `BusinessListingSnapshot` now require Location ownership.

External review import, listing import, reputation overview and response mutation receive Location from trusted request authority rather than payload-supplied location.

Internal reputation management also proves that the linked Appointment belongs to the selected Location before review mutation.

### 7. Regression protection

The dedicated `Point 8B Campaign Hub Gate` runs:

- Point 6 campaign/attribution contracts;
- Point 6 social/reputation/performance contracts;
- Stage 8B location-ownership contracts;
- backend source checks;
- backend application import verification.

## Explicitly not performed

- No production database migration or backfill.
- No inference of Location for legacy rows.
- No social provider activation.
- No production deployment.
- No cross-location reporting implementation.
- No Customer identity split.

Legacy operational rows without authoritative Location evidence must be handled by a separate controlled migration. Ambiguous records must not be assigned automatically.

## 8B completion criterion

8B is considered source-complete when the dedicated CI gate is green and the branch is merged to `main`. Production activation remains a separate controlled step.
