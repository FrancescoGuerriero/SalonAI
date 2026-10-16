# DEV4 #309 — Report / export tenant ownership audit

Date: 2026-10-16
Authority: Roadmap v3 coordination #280 / report-export ownership issue #309
Owner: DEV4

## Purpose

This document is the read-only repository audit required before changing report or export behaviour. It records the current source collections, their ownership state, the unsafe global query patterns that remain on `main`, and the activation dependencies for tenant-safe reporting.

This audit does **not** change runtime queries, create a second authorization system, execute a migration, or accept client-supplied Business/Location identifiers as authority.

## Current report / export entry points

### Management reports

`backend/src/features/reports/reportService.js` currently reads:

- `Customer`
- `Appointment`
- `CustomerContactLog`
- `Campaign`

Current report operations include:

- appointment CSV;
- communications CSV;
- management workbook;
- summary counts;
- completed-appointment revenue aggregation.

The current service creates query objects from date/status filters only. `Customer.countDocuments()` is global. Appointment, communication and campaign counts are global apart from date/status filters. Revenue aggregation is global apart from date/status.

`reportController.js` forwards `req.query` directly to the report service. `reportRoutes.js` checks `data-export:manage` on downloads, but permission gating is not tenant data isolation. No trusted Business/Location scope is passed to the service.

### Dataset exports / export audit

`backend/src/features/dataExportAudit/dataExportAuditService.js` currently reads:

- `Appointment` for the appointments dataset;
- `RebookingCampaign` for campaigns;
- `InventoryItem` for inventory;
- `CustomerFeedback` for feedback;
- `FutureAuditEvent` for export audit history.

All current dataset reads are global apart from time windows. Audit-event listing is global apart from dataset/page filters. Newly created export audit records currently contain actor metadata but no canonical Business or Location ownership fields.

## Source-domain ownership matrix

| Source | Current ownership on `main` | Required #309 handling | Dependency / action |
| --- | --- | --- | --- |
| `Customer` | Global on current `main` | Business-owned source before customer counts/exports | #380 transitional ownership + controlled production backfill + route/query activation |
| `Appointment` | Global on current `main` | Business + Location-owned source before appointment/revenue/location aggregation | #380 transitional ownership + controlled production backfill + trusted route/query activation |
| `CustomerContactLog` | No direct Business/Location fields; required Customer ref, optional Appointment ref | Do not query globally. Prefer explicit Business ownership; add Location where event semantics are location-specific. Backfill must validate referenced Customer/Appointment ownership. | New source-domain ownership increment under #309 or dedicated communications ownership issue |
| `Campaign` | No Business/Location fields | Add Business ownership. Location scope should be explicit only for location-targeted campaigns; Business-wide campaigns must remain Business-scoped rather than globally visible. | #309 communications/report source migration; validate recipients/segment in same Business |
| `RebookingCampaign` | No Business/Location fields | Add Business ownership and optional/effective Location scope where campaign is generated for a location. Recipient Customer/Service/Appointment refs must not cross Business. | #309 / communications ownership increment |
| `InventoryItem` | No Business/Location fields; SKU is globally unique | Inventory cannot be made tenant-safe through report filters. Introduce Business ownership and define whether stock is Business-wide or Location-owned before export activation. Audit SKU uniqueness before tenant-local index change. | Dedicated inventory ownership migration consumed by #309 |
| `CustomerFeedback` | No direct Business/Location fields; optional Customer/Appointment/Service/Stylist refs | Add trusted Business ownership. Location should derive from the appointment when present or from an explicitly trusted operational context for non-appointment feedback. Cross-Business references must fail closed. | #309 feedback source migration after #380/#287/#306 contracts |
| `FutureAuditEvent` | No Business/Location fields | #309 should own this change directly: every export event records trusted Business plus selected/effective Location scope (or explicit Business-wide aggregate scope). Audit listing must be tenant-scoped. | #309 direct implementation |

## Ownership joins are not authority

A populated reference must not be treated as proof that a globally selected source record belongs to the active tenant. For example, loading every `CustomerContactLog` globally and then populating `customer.business` would expose/scan cross-tenant records before scope is enforced.

Safe patterns are:

1. direct Business/Location ownership on the source document; or
2. a server-derived set of authorised source IDs built from already tenant-owned records, applied in the database query itself.

For high-volume reporting and auditability, direct source ownership is preferred for contact logs, campaigns, feedback and export audit records.

## Trusted reporting scope contract

After the source domains are ready, report/export services should accept a server-created scope object rather than raw tenant identifiers:

```js
{
  businessId,
  selectedLocationId,
  allowedLocationIds,
  allLocations,
  scopeMode: "selected-location" | "allowed-locations" | "business-wide"
}
```

The scope must be derived from trusted tenant/effective-authority middleware. The service must not construct authority from query/body/header Business or Location values.

### Scope semantics

- `selected-location`: require one trusted selected Location and filter location-owned rows to it.
- `allowed-locations`: aggregate only the membership's trusted allowed Locations.
- `business-wide`: allowed only for an authoritative Business-wide permission; still filter every Business-owned source by the trusted Business.
- absence of required location authority fails closed rather than returning a global result.

## Report-service target query rules

### Appointment rows / CSV / workbook

After #380 activation:

- always include trusted `business` in the Appointment query;
- selected/allowed-location reporting additionally filters trusted `location`;
- populated Customer/Service/Stylist references must remain same-Business as guaranteed by source-domain ownership enforcement;
- raw query `business`, `businessId`, `location`, `locationId` must be ignored as authority.

### Summary

- Customer count: `Customer.countDocuments({ business: trustedBusiness })`;
- Appointment count/revenue: filter by trusted Business plus effective Location scope;
- contact count: blocked until `CustomerContactLog` becomes tenant-owned or an equivalent safe database-level scope exists;
- campaign count: blocked until `Campaign` becomes Business-owned;
- do not return a partially global summary while other rows are scoped. If required source ownership is unavailable, return an explicit unavailable/blocker result or fail closed according to the route contract.

### Communications CSV

Blocked for multi-tenant activation until contact-log ownership is safe. Date filters are secondary to tenant scope.

## Dataset-export target rules

### Appointments

Consume #380 Business/Location ownership and effective scope.

### Campaigns

Blocked until `RebookingCampaign` is Business-owned and its recipient references are tenant-consistent.

### Inventory

Blocked until Inventory ownership semantics are defined and migrated. Global SKU uniqueness must be audited separately before tenant-local uniqueness is considered.

### Feedback

Blocked until `CustomerFeedback` has trusted Business ownership and safe Location attribution semantics.

### Export audit events

Add canonical fields such as:

- `business` (required after migration);
- optional `location` for selected-location exports;
- `scopeMode`;
- optional snapshot of allowed-location count rather than exposing raw authority arrays where unnecessary.

Audit-event listing must require trusted Business and apply the same effective Location constraints appropriate to the viewer.

## Migration/readiness sequence

1. Merge #333 Customer user-account index correction (#433 replacement).
2. Complete #380 Customer/Appointment ownership replacement from current `main`.
3. DEV1 runs #380 production readiness + deterministic dry-run plan.
4. Review exact plan fingerprint and blockers.
5. DEV1 executes guarded #380 backfill after approval and verifies zero unowned Customer/Appointment rows.
6. Activate trusted Customer/Appointment route/query isolation and cross-tenant tests.
7. Begin #309 source-domain ownership increments:
   - export audit events;
   - CustomerContactLog;
   - Campaign/RebookingCampaign;
   - CustomerFeedback;
   - Inventory (dedicated ownership semantics if required).
8. Add trusted report/export scope resolver consuming DEV3 effective authority.
9. Replace global report/export queries with Business/Location-scoped queries.
10. Add cross-tenant/location report/export regression tests.
11. Verify canonical single-location SalonAI totals exactly match pre-migration baselines.
12. Only then mark #309 complete and reactivate #295 generic Tenant-2 provisioning.

## Required regression coverage

At minimum:

- Tenant A Customer count cannot include Tenant B;
- Tenant A Appointment/revenue cannot include Tenant B;
- selected Location excludes other Locations;
- allowed-location aggregate never exceeds effective membership scope;
- Business-wide authority still filters by Business;
- communication exports cannot scan cross-Business contact logs;
- campaign exports cannot scan cross-Business campaigns;
- inventory export cannot run multi-tenant while ownership is unresolved;
- feedback export excludes cross-Business feedback;
- export audit events are Business-scoped and Location-aware where applicable;
- query/body/header tenant identifiers cannot expand scope;
- cross-tenant object IDs do not expand scope;
- dry-run ownership planning performs zero writes;
- canonical SalonAI pre/post report totals remain stable.

## DEV2 presentation handoff

Future report UI may display server-supplied scope/provenance such as:

- Business label;
- selected Location label;
- "All authorised locations" aggregate state;
- unavailable/blocked state where a source domain is not tenant-safe;
- export audit scope label.

React must display those authoritative values only. It must not decide which Locations a user is authorised to aggregate.

## Exit gate from this audit

This audit is complete when the source matrix is accepted and #309 implementation work uses these ownership dependencies rather than adding client-driven filters to the existing global queries.
