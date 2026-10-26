# Point 9 — CRM and Retention (original Phase 11)

## Purpose

Point 9 restores the original Phase 11 salon CRM intent without creating a competing customer system. The canonical `Customer` remains the business-level identity. Operational service evidence, technical salon records and retention facts remain location-owned.

## Reused foundations

The implementation deliberately reuses the completed Stage 7 CRM and retention foundation:

- Customer 360 v2;
- lifecycle states and deterministic CRM segmentation;
- consent-aware retention journeys and enrolments;
- appointment/service history;
- communications and campaign attribution;
- loyalty, gift cards, referrals and membership recovery evidence.

## New Phase 11 gap closure

### Location-owned technical salon record

`ClientTechnicalServiceRecord` captures durable service evidence linked to the canonical Customer and a required Location. It supports:

- colour, chemical, treatment, cut, consultation and general records;
- structured formula components (brand, line, shade, developer, ratio and quantity);
- technical notes and result notes;
- patch-test evidence;
- before/after/consultation/formula photo references;
- appointment, service and stylist links;
- actor provenance and timestamps.

A record cannot be created without a specific location. When an appointment is supplied it must match the same business, location and customer.

### Deterministic retention queue

The Point 9 queue is derived from canonical completed appointments. Where at least two recent visits are available, expected rebooking cadence is the median observed visit interval. When there is insufficient history, the original Phase 11 eight-week rebooking interval is used as a 56-day fallback.

States are:

- `booked`;
- `healthy`;
- `approaching_due`;
- `due`;
- `overdue`;
- `dormant`;
- `no_visit_history`.

Dormancy is deterministic and uses the later of 90 days or cadence + 30 days. The queue does not send communications or enrol customers automatically.

## Authority model

- Customer identity is business-owned.
- Appointments and technical records are location-owned.
- Effective authority is required for Point 9 operational routes.
- Selected-location users only see records and retention facts for authorised locations.
- Business-wide authority may aggregate across locations but a technical-record mutation must still name or resolve one specific location.
- Ambiguous legacy data is not assigned to a location automatically.

## API additions

- `GET /retention-automation/crm/retention-queue`
- `GET /retention-automation/crm/customers/:customerId/technical-records`
- `POST /retention-automation/crm/customers/:customerId/technical-records`

## UI

The Retention Automation workspace now includes a Point 9 panel containing:

- retention-state filtering;
- due/overdue/dormant rebooking queue;
- observed cadence and due date;
- selected-customer salon technical history;
- formula, patch-test and photo evidence summaries.

Stage 7 Customer 360, journeys and recovery controls remain intact below the Point 9 workspace.

## Safety boundary

This tranche does not enable:

- autonomous customer messaging;
- production migration or backfill;
- provider activation;
- scheduled retention workers;
- AI model promotion or production inference;
- payment execution;
- deployment.

All Point 9 retention outputs are deterministic evidence and carry `executionAuthorised: false`.

Refs #570.
