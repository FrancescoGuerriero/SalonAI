# Staff schedule tenant/location authority contract

Authority: DEV3 Gate C #298  
Dependencies: completed workforce ownership #306; Appointment ownership #380 for appointment-derived selected-location views

## Purpose

The #306 migration made the workforce scheduling child records tenant-aware:

- `StaffAvailability.business` / `location`;
- `StaffTimeOff.business` / optional `location`;
- `StaffShift.business` / trusted `locationRef`;
- `StaffAttendance.business` / trusted `locationRef`.

This document defines how DEV3 consumes those ownership fields without allowing client-supplied Business/Location identifiers to create authority.

## Authority source

Schedule authority comes only from the current effective authority produced from the trusted host, active BusinessMembership and trusted Location context.

Client body, query, route metadata or legacy free-text location values do not expand authority.

## Business-wide management

An all-location membership scopes workforce child records to:

`record.business === effectiveAuthority.businessId`

Business ownership remains mandatory even when location access mode is `all`.

## Selected-location management

A selected-location membership may access only child records whose trusted Location is within `effectiveAuthority.allowedLocationIds`.

For an operation that must act at the active selected Location, the record Location must also equal `effectiveAuthority.locationId`.

Cross-Business or out-of-scope Location records use non-disclosing `404 RESOURCE_NOT_FOUND` semantics.

## Business-wide schedule blocks

`StaffTimeOff.location` may intentionally be absent when a leave/block applies across all employee Locations.

Such records are visible only through an explicit `allowBusinessWide` contract. They must not be treated as implicitly location-authorised merely because the Location value is absent.

Location-specific mutations should require a trusted selected Location.

## Creation ownership

Location-owned Availability/Shift/Attendance records require a trusted active selected Location.

The ownership stamped by the service must come from effective authority:

- Business = trusted active Business;
- Location = trusted selected Location.

An all-location authority may create a record with no Location only when that domain operation explicitly permits a Business-wide record, such as an all-location leave block.

## Appointment-derived schedule views

Current staff day/rota views can include Appointment data.

Appointment Business/Location ownership is governed by DEV4 #380 and is not yet a fully trusted source contract. Therefore selected-location schedule views that derive or combine Appointment data must fail closed until #380 provides trusted Appointment Location ownership.

The contract exposes this explicitly through `APPOINTMENT_LOCATION_SCOPE_REQUIRED` rather than pretending a user-supplied Location or a Stylist relationship proves Appointment Location ownership.

## Activation sequence

1. Merge this pure authority/query contract with tests.
2. Activate StaffAvailability and StaffTimeOff management paths that can be bounded entirely by #306-owned records.
3. Preserve self-service by binding the authenticated User to a Stylist in the same trusted Business.
4. Activate Shift/Attendance paths using `business` and `locationRef` after their controller/service queries are converted.
5. Keep selected-location day/rota views that include Appointment data closed until #380 is production-owned and route-safe.
6. After #380, replace the temporary Appointment boundary with direct Business + Location Appointment filters and cross-tenant tests.

## Invariants

- management visibility is independent of `profilePublished`, `acceptsAppointments` and `isActive`;
- no second RBAC or tenancy system;
- no client Business/Location value grants authority;
- legacy `StaffShift.location` free text is presentation/compatibility data, not trusted Location authority;
- current canonical single-location SalonAI behavior must remain unchanged while the new scope is activated incrementally.
