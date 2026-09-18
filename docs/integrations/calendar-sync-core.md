# Calendar Integration Core

## Product authority

**SalonAI's internal appointment calendar and Appointment records are the canonical scheduling system.** Employees work in SalonAI first. External calendars never become the source of truth for appointment permissions, availability, lifecycle state or booking ownership.

Google Calendar and Microsoft Outlook are optional synchronization connectors. They mirror approved SalonAI appointment state for users who choose to connect them.

The existing bot/WhatsApp booking paths must continue to create/change the same SalonAI Appointment records through the same booking/appointment lifecycle rules. They do not maintain a separate calendar.

## Goal

Provide one optional external calendar-sync contract that future Google Calendar and Microsoft Outlook adapters can implement without embedding provider-specific behavior in appointment/business logic.

This increment does **not** connect a real external calendar. It adds the safe application boundary that must exist before OAuth, token storage, webhooks and production synchronization are introduced.

## Event privacy contract

Appointment calendar events are private by default.

The default exported event contains:

- SalonAI appointment identifier;
- start and end instants;
- salon IANA time zone;
- service name;
- stylist display name;
- booking source;
- internal model identifiers required for deterministic synchronization.

It intentionally excludes:

- customer name unless explicitly opted in;
- customer email;
- customer phone;
- appointment notes;
- internal notes;
- payment data;
- health/hair-profile data.

Provider adapters must not silently expand this contract with additional customer data.

## Synchronization contract

`CalendarSyncService.syncAppointment()` requires:

- a catalogue entry in the `calendar` category;
- an adapter registered in the integration registry;
- explicit `calendar.write` capability;
- a target calendar ID;
- an appointment with valid `startsAt` and `endsAt`.

The adapter receives a deterministic idempotency key:

`appointment:<SalonAI appointment id>`

A provider implementation should use that stable source identity to update an existing external event rather than create duplicate events.

## Internal calendar first

Before activating an external provider, Developer 1 must complete the internal management calendar so authorised employees can create and change appointments directly in SalonAI.

Mutation authority is permission-based. Appointment viewing/creation/update permissions are assigned through SalonAI's staff authorization model; role names alone must not create an uncontrolled mutation path. Super Admin governs delegation, while Admin and Receptionist can change appointments only when the relevant permission is assigned. Bot/WhatsApp changes must pass through the same appointment conflict, availability and lifecycle invariants.

## Optional provider roadmap

### Google Calendar

Next provider-specific work should add:

- OAuth 2.0 authorization with least-privilege calendar scopes;
- encrypted refresh-token persistence;
- calendar selection;
- deterministic SalonAI appointment -> Google event mapping;
- create/update/cancel synchronization;
- webhook/channel renewal;
- replay protection and reconciliation;
- sandbox/test-account acceptance.

### Microsoft Outlook Calendar

Implement against the same core contract using Microsoft Graph after the Google adapter proves the contract.

## Activation rule

Merging calendar core or an adapter does not activate production synchronization.

Activation requires:

1. provider credentials/configuration outside source control;
2. OAuth/token-storage security review;
3. provider sandbox acceptance;
4. idempotency and cancellation/reschedule tests;
5. observability and failure/retry policy;
6. explicit production feature control;
7. immutable release and governed deployment.
