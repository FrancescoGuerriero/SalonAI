# SALON AI — Core location ownership, CRM tranche

**Reference product:** SALON AI  
**Current delivery model:** one business, one or more locations  
**Rule:** operational data belongs to a Location; cross-location visibility requires an explicit authorised aggregation layer.

## This tranche

This tranche reconciles CRM Lead and Opportunity ownership without reopening DEV4 multi-tenant expansion.

- Lead now requires Location ownership.
- Opportunity now requires Location ownership.
- Lead indexes and deduplication uniqueness are location-scoped.
- Opportunity indexes are location-scoped.
- CRM routes resolve the existing trusted effective authority.
- All lead lifecycle operations require a selected Location.
- Lead IDs from another location are rejected before read/update/score/nurture/convert operations.
- Opportunity IDs from another location are rejected before update.
- Opportunity Location is immutable through the CRM API.
- Lead capture uses a location-derived idempotency key so the same contact can exist independently in two salon locations without being silently collapsed into one operational CRM lead.

## Existing architecture preserved

### Services

`Service` remains the reusable business-owned catalogue definition. `LocationServiceOffering` remains the operational location-owned service record and is the correct layer for location-specific availability, bookability, price, duration and publication overrides.

This tranche does not duplicate Service rows per location.

### Employees

A staff/person identity remains singular. Existing `workingLocations` membership constrains where that employee operates. This tranche does not duplicate employee identities per salon.

## Customer boundary deliberately not changed here

The current Customer model mixes login-linked identity with operational CRM/customer state, and `User.customerProfile` is a single canonical pointer. Social sign-in can create that profile before a salon location is selected.

Therefore this tranche does **not** make the existing Customer model location-required. That change requires a separate identity/profile reconciliation so one customer login can legitimately interact with multiple salon locations while each location retains its own customer/CRM operational profile.

Lead conversion remains guarded by the selected Lead location, but the existing canonical Customer identity/profile behaviour is preserved until that dedicated tranche.

## Appointment boundary

Appointment already carries Location but its field is transitional/optional in current main. Appointment creation has several managed, walk-in, waitlist, trial, group, consultation, WhatsApp and sequence paths. Required Location activation will be implemented in a separate tranche after every writer passes trusted location context.

## Migration boundary

This is source-contract work only.

No production migration, backfill, deployment, Customer split, Appointment backfill, provider activation, AI activation or cross-location aggregation is performed here. Existing Lead/Opportunity records without authoritative Location evidence require a separate controlled migration before a required-field production cutover. Ambiguous records must not be auto-assigned.
