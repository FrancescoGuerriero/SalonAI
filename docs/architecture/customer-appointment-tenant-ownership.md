# Customer and Appointment tenant/location ownership

Issue: #380  
Owner: DEV4  
Consumers: DEV3 effective authority, #309 reports/export, future Tenant-2 provisioning

## Purpose

Prepare the canonical CRM and booking records for AIIBP multi-tenancy without changing current Salon AI runtime behaviour before production migration evidence exists.

Target:

```
Business
  -> Customer
  -> Appointment
       -> Location
       -> Customer
       -> Service
       -> Stylist
```

## Additive preparation phase

The first implementation increment adds optional fields only:

- `Customer.business`;
- `Appointment.business`;
- `Appointment.location`.

No ownership field is required yet.

Current controllers/routes remain unchanged in this preparation phase.

## Legacy uniqueness retained

The following current global uniqueness constraints are deliberately preserved until production data is backfilled and audited:

Customer:
- `userAccount`;
- `email`;
- `phone`.

Appointment:
- `invoiceNumber`;
- `externalBookingReference`.

Future tenant-local index changes must be separate, reviewed migrations. They must not be silently changed as a side effect of ownership backfill.

## Legacy backfill scope

Global unowned Customer attribution is safe only while the canonical Business is the sole Business in the database.

Global unowned Appointment attribution is stricter: it requires both:
- exactly one canonical Business;
- exactly one active/non-archived Location for that Business.

This prevents old appointments being blindly assigned to one Location after multi-location expansion begins.

Once multiple Businesses or Locations exist, migration must use explicit reviewed per-record mapping rather than global defaults.

## Appointment integrity

Before an Appointment may be assigned to the canonical Business/Location, the readiness planner requires:

- referenced Customer exists and is either already same-Business or safely planned for same-Business backfill;
- referenced Service exists and is already owned by the same Business;
- referenced Stylist exists and is already owned by the same Business;
- any existing Appointment Business ownership agrees;
- any existing Appointment Location ownership agrees.

This composes the already-migrated #306 workforce and #287 Service ownership contracts rather than inventing another authority system.

## Current integration side effects to preserve

Appointment remains canonical for:
- calendar outbox enqueue after appointment saves;
- AI/no-show outcome observation on terminal state;
- payment/invoice state;
- WhatsApp/booking/customer flows.

Ownership backfill must therefore update only ownership fields and must not recreate appointments or trigger business-state transitions unnecessarily.

## Current migration boundary

Allowed:
- additive optional schema fields;
- indexes that support future tenant-scoped reads;
- pure readiness planner;
- zero-write deterministic backfill planning;
- tests and documentation.

Not yet allowed:
- production migration;
- controller/route tenant enforcement;
- required ownership activation;
- tenant-local uniqueness/index cutover;
- Tenant-2 Customer/Appointment creation;
- LocationServiceOffering requirement for current appointments.

## Required next steps after #287 final production acceptance

1. repository/live read-only readiness scanner;
2. count reconciliation for Customer/Appointment/Service/Stylist/Location;
3. zero-write deterministic plan + fingerprint;
4. conflict/ambiguity review;
5. guarded transactional apply;
6. postflight zero-remaining verification;
7. trusted public/management route enforcement;
8. tenant-local index hardening;
9. required ownership activation.

No migration runs automatically at backend startup.


## Read-only readiness and zero-write planning

Repository/live readiness command:

```bash
npm run customer-appointments:tenant-readiness
```

The command is read-only and reports only:
- Business/Location migration-scope counts;
- Customer Business ownership coverage;
- Appointment Business/Location ownership coverage;
- blocker types/counts;
- transitional legacy unique-index names.

It deliberately excludes Customer, Appointment, Business and Location identifiers plus customer PII.

After readiness is clean, generate the deterministic zero-write plan:

```bash
npm run customer-appointments:tenant-backfill-plan
```

The plan:
- reuses the exact same canonical snapshot loader as readiness;
- proposes only missing Customer Business and Appointment Business/Location ownership updates;
- creates no Customers or Appointments;
- produces matching rollback-operation counts;
- binds the reviewed Customer -> Appointment -> Service -> Stylist relationships into a SHA-256 plan fingerprint;
- exposes no resource identifiers or PII in operator output;
- performs no writes.

The fingerprint is intentionally sensitive to reviewed relationship changes even when the high-level update counts remain the same.

No apply executor exists in this preparation slice.
