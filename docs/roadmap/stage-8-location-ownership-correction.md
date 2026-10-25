# Stage 8 — SALON AI location ownership correction

**Authority:** Roadmap v2.9 Stage 8 / Issue #237  
**Reference product:** SALON AI  
**Delivery rule:** finish one business first; preserve later modular/tenant expansion without extending DEV4 now.

## Product boundary

SALON AI is currently one business that may operate several locations.

Operational truth belongs to the location. A business-level management view may later aggregate authorised location results, but aggregation does not change ownership of the underlying data.

This rule applies to customer/CRM, workforce, services, appointments, marketing, BI and AI context as those domains are completed or reconciled.

For the Marketing Data Core / Data Hub / AI evidence slice, the canonical hierarchy is:

`SALON AI business -> Location -> source -> sync run -> raw record -> normalised fact -> BI view/evidence -> AI planning evidence`

## Connection versus data ownership

Provider credentials and OAuth applications may remain business-level infrastructure when a provider account is legitimately reused across SALON AI locations. That does not make the resulting operational data business-owned.

Each provisioned MarketingDataSource is location-owned. Raw records, normalised records, sync runs, SEO observations, Data Hub saved views, destination tasks, destination previews and AI evidence all retain the selected Location identifier.

If a shared provider credential is disconnected, every location source that depends on that business-level credential is paused fail-closed.

## Selected-location default

Marketing Data Core and Data Hub operations require a selected effective location.

The following operations are location-scoped by default:

- provider-source provisioning;
- manual and scheduled ingestion;
- retries/recovery;
- provider live-read execution when separately authorised;
- raw and normalised marketing facts;
- technical SEO observations;
- Data Hub field/source catalogue;
- Data Hub queries and totals;
- saved views;
- destination previews and run evidence;
- Data Hub AI evidence;
- AI Gateway planning evidence.

A source, saved view, destination task or run from another location is not accepted merely because it belongs to the same business.

## Business-wide reporting

Business-wide visibility is not implicit in the data model.

Future owner/admin cross-location reporting must be implemented as an explicit authorised aggregation layer over location-owned facts. It must preserve each fact's location provenance and must not rewrite the facts as shared business data.

The current Stage 8 evidence contract therefore records:

- `locationOwnershipRequired: true`;
- `businessWideAggregationRequiresExplicitAuthority: true`;
- gateway metadata `locationOwned: true`;
- gateway metadata `businessWideAggregationAuthorised: false` by default.

## AI boundary

`data_hub_evidence_v1` now requires both `business_id` and `location_id`.

The AI Gateway remains planning-only in this slice. It does not:

- execute inference through this bridge;
- retrain or promote a model;
- perform external writes;
- merge data across locations;
- recalculate canonical BI metrics.

## DEV4 / future tenant expansion

Existing DEV4 SaaS/multi-tenant work is preserved but frozen. This correction does not add tenant provisioning, new verticals, white-labelling, SaaS billing, or cross-tenant orchestration.

The present goal is to finish SALON AI as one complete reference business while keeping modules clean enough for later capability-based tenant deployment.

## Migration and activation boundary

This change alters source-level ownership contracts by making Location required on Marketing/Data Hub persistence models.

**No production migration, backfill, provider activation, scheduled-worker activation, deployment, model promotion or inference activation is performed by this change.**

Any existing persisted records that pre-date mandatory Location ownership must be reconciled in a separate controlled migration using authoritative source/location evidence before production activation. Ambiguous legacy records must not be assigned to a location automatically.
