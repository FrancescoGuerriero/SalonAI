# Point 12 — AIIBP managed data connections

Date: 26 October 2026  
Module: Marketing / Integration Hub  
Status: commercial source baseline complete; live-provider/manual acceptance required before production activation.

## Purpose

AIIBP provides a provider-neutral managed data-connection capability for tenant-specific SaaS configurations. A Business enables only the connections it needs, authorises provider accounts through secure provider/adapter flows, and imports Business/Location-owned evidence into the canonical AIIBP Data Hub for dashboards, BI, automation and governed AI assistance.

AIIBP owns the product contract. External systems are connection targets or implementation adapters; they are not product architecture authorities.

## Connection modes

- **Native AIIBP adapters** — direct provider integrations for deeper first-party verification/control or governed write operations.
- **Managed data-connection adapters** — optional broad read/analytics connectivity behind the provider-neutral AIIBP gateway contract.

A provider appears once as a commercial connection capability even when more than one implementation mode is available.

## Provider-neutral runtime contract

Server configuration:

- `AIIBP_DATA_CONNECTION_API_KEY`
- `AIIBP_DATA_CONNECTION_API_BASE_URL`
- `AIIBP_DATA_CONNECTION_ONBOARD_BASE_URL`
- optional `AIIBP_DATA_CONNECTION_REQUESTS_PER_MINUTE`
- optional `AIIBP_DATA_CONNECTION_REQUESTS_PER_DAY`

The gateway supports connector discovery, connection metadata, secure authorisation sessions, linked-account reconciliation/unlink, field/options discovery, account-scoped data queries, date ranges/presets and bounded row retrieval.

Secrets remain server-side. Temporary authorization credentials are stored through the existing encrypted provider-credential system. AIIBP does not collect ordinary provider passwords.

## SaaS tenancy

Authority chain:

`AIIBP Business -> authorised connection -> provider account -> AIIBP Location -> Data Hub source`

Every preview, import, backfill, seller KPI read and unlink fails closed unless the requested account/source belongs to the active Business and, for Data Hub operations, active Location.

## Sellers

Seller connections include Amazon Seller Central, Amazon Vendor Central, eBay, TikTok Shop and supported commerce marketplaces.

Curated commercial profiles currently include:

- Amazon orders/revenue
- Amazon inventory health
- eBay orders/seller proceeds
- eBay listing traffic/conversion
- eBay promoted listings

The curated profiles prevent indiscriminate high-cardinality ingestion while still allowing governed custom field selections.

## Data Hub ingestion

Managed sources use the existing canonical Marketing Data Core:

`MarketingDataSource -> raw records -> normalised records -> lineage -> sync runs -> health`

There is no adapter-specific reporting database.

Supported cadence:

- manual
- hourly
- daily
- weekly

Scheduled sources reuse the shared Marketing Data Sync Worker, checkpoint watermark, location ownership, concurrency and retry controls.

## Historical backfill

Historical import uses bounded adaptive date slicing:

1. split requested history into date slices;
2. cap each request at the configured row bound;
3. recursively subdivide saturated slices;
4. stop at one-day windows;
5. mark one-day saturation explicitly instead of claiming completeness.

Guardrails:

- maximum single backfill range: 366 days;
- default slice: 7 days, up to 31 days;
- maximum 120 requests per operation;
- incremental checkpoint is preserved during backfill.

## Rate-budget protection

Persistent Mongo-backed minute/day counters protect all application instances from exhausting a configured adapter budget. Defaults are conservative and can be adjusted per deployment through AIIBP environment configuration. Exhausted budgets fail closed with an AIIBP rate-budget error rather than silently overrunning an external service limit.

## Seller KPI evidence

Seller KPI summaries consume tenant/location-scoped `MarketingNormalisedRecord` evidence. The KPI service does not bypass the Data Hub by reading directly from a provider response.

## AI assistance boundary

AI may:

- recommend relevant connections;
- explain setup;
- suggest field mappings;
- diagnose connection/data-quality issues;
- interpret metrics and anomalies;
- propose marketing/seller actions for human review.

AI may not:

- expose credentials;
- cross Business/Location boundaries;
- connect/unlink accounts autonomously;
- execute provider write actions without a separate governed contract;
- replace deterministic Data Hub evidence as source of truth.

## Production activation checklist

Before enabling a tenant:

1. configure the approved managed connection adapter through production secret/environment management;
2. confirm commercial limits and expected tenant/account volume;
3. verify authorization URLs/secrets are excluded from logs/APM;
4. test Business and Location isolation;
5. connect representative live providers, including required seller channels;
6. validate live provider fields against curated profiles;
7. test preview, import, cadence, backfill, KPI and unlink;
8. validate KPI values against provider-native reports;
9. confirm privacy/retention/provider terms;
10. complete HCI/accessibility/browser acceptance;
11. explicitly enable the shared sync worker only for approved production tenants;
12. keep provider write actions disabled until separately approved.

No production credential, provider activation, sync-worker enablement, production backfill or provider write action is performed by this source-development record.
