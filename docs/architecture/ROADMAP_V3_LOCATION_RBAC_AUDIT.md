# Roadmap v3.0 — Location-Scoped RBAC Audit

Owner: DEV3  
Issue: #278  
Baseline: `main@b14f56e801ee4337cef765f1b40cb0e555ed7217`

## Current authority model

Current SalonAI already has:
- a User role key;
- direct user permissions;
- role-derived permissions;
- a StaffRole registry;
- server-side permission middleware;
- role-aware management navigation.

These remain authoritative. Multi-location development must extend them rather than create a second RBAC system.

## Gap introduced by multi-location SaaS

The current authority model does not yet express a trusted relationship of:

`User -> Business membership -> role -> location scope -> permission`

DEV4 issue #279 owns BusinessMembership, Location and trusted tenant/location context. DEV3 must not define competing tenant primitives.

## Audit matrix

For every protected management function classify scope as:

| Scope | Meaning |
| --- | --- |
| platform | platform Super Admin only |
| business | valid across the whole tenant |
| location | limited to one or more authorised locations |
| self | employee can operate only on own profile/schedule/data |
| customer/public | not staff authority |

Initial permission families requiring location review:
- appointments and appointment payments;
- customers;
- employees and staff profiles;
- schedules and leave;
- services and products;
- inventory and purchasing;
- communications;
- loyalty and gift cards;
- reports/analytics;
- AI use and AI action approval;
- feature controls;
- imports/exports;
- staff-role administration.

## Required effective-authority contract

After DEV4 contracts stabilise, the backend should be able to answer:

1. Which BusinessMembership authorises this user?
2. Which business is active?
3. Which locations are allowed?
4. Which role key is active for that membership?
5. Which baseline, role and directly delegated permissions apply?
6. Is the requested resource inside that business/location scope?
7. Is the action audit-worthy or approval-gated?

Navigation visibility is a consequence of this authority; it is never the enforcement mechanism.

## Fail-closed requirements

- no valid membership -> no tenant access;
- suspended/revoked membership -> no tenant access;
- selected-location membership with empty selection -> no location access;
- resource in another business -> 404-style denial;
- resource in another location -> 404-style denial unless a documented cross-location permission exists;
- missing location context for a location-scoped action -> deny rather than infer;
- frontend-supplied tenant/location id alone never grants authority.

## Implementation blockers

Do not implement location-aware permission middleware until DEV4 #279 publishes:
- BusinessMembership schema/contract;
- Location schema/contract;
- trusted tenant/location resolver;
- cross-tenant/location isolation tests.

## DEV3 next audit work

- map dashboard/side-menu routes to current permission constants;
- identify permissions that should remain business-wide versus become location-sensitive;
- identify staff/profile queries that currently assume one business/location;
- specify effective-permission inspection UI for Super Admin/Admin;
- identify required audit events when role or location scope changes;
- hand the matrix to DEV4 and DEV1 before code implementation.

## Acceptance for audit phase

Audit phase closes when every management route/function has:
- authoritative permission;
- intended business/location scope;
- owner;
- data source;
- duplicate/legacy-path disposition;
- implementation dependency.
