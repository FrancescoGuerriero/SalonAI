# Point 12 — Windsor Marketing connector platform

Date: 26 October 2026  
Module: Marketing  
Status: **commercial source baseline complete; manual/live-provider acceptance required before production activation.**

## 1. Purpose

The Windsor integration is an internal Marketing-module connection and data-ingestion capability. A Business enables only the connectors it needs, authorises provider accounts through Windsor/provider-hosted flows, and imports tenant/location-owned evidence into the canonical AIIBP Marketing Data Hub for dashboards, BI and governed AI assistance.

This does **not** replace native AIIBP provider adapters:

- **Windsor** provides broad read/analytics source coverage and rapid SaaS onboarding.
- **Native AIIBP adapters** remain appropriate where deeper first-party control or later provider-specific write operations are required.

A provider must appear as one commercial capability with connection mode(s), not as duplicate products.

## 2. Windsor implementation contract

Primary Windsor contracts used by Point 12:

- connector discovery: `GET https://connectors.windsor.ai/list_connectors?api_key=...`;
- field schema: `GET https://connectors.windsor.ai/{connector}/fields?api_key=...`;
- connector options: `GET https://connectors.windsor.ai/{connector}/options?api_key=...`;
- data query: `GET https://connectors.windsor.ai/{connector}` with `fields`, `select_accounts`, `_max_rows`, date-window/preset and optional refresh controls;
- connection metadata: `GET https://onboard.windsor.ai/api/mcp/connectors/{connector}/connect-info?api_key=...`;
- single-source co-user authorisation: `GET https://onboard.windsor.ai/api/team/generate-co-user-url/`;
- linked-account reconciliation and unlink through the Windsor team/co-user account endpoints.

`WINDSOR_API_KEY` remains server-side. Temporary co-user access tokens are encrypted through the existing provider-credential system. The browser never receives the team API key and AIIBP never asks customers for ordinary provider passwords.

## 3. SaaS tenancy and authority

Authorisation is scoped as:

`AIIBP Business -> Windsor authorisation session -> connector -> Windsor account IDs -> AIIBP Location Data Hub source`

The implementation records Business, optional selected Location, connector, account IDs/names, authorisation/reconciliation timestamps and encrypted session credential evidence.

Every preview, import, historical backfill, seller KPI read and unlink operation fails closed unless the requested account/source belongs to the active Business and, for Data Hub operations, active Location. Provider data is evidence; AIIBP remains the authority for tenant identity, permissions, canonical business domains and normalized data lineage.

## 4. Commercial connector catalogue

The requested Windsor catalogue is metadata-driven and separates integration roles:

- **Sources:** advertising, analytics, CRM, social, finance and business evidence.
- **Sellers:** Amazon Seller Central, Amazon Vendor Central, eBay, TikTok Shop and other supported marketplaces.
- **Data platforms:** warehouse/database/file systems such as BigQuery, Redshift, S3, MongoDB, MySQL, Dataverse and Sheets.
- **Destinations / AI destinations:** downstream systems such as Power BI, ChatGPT, Claude and Copilot Agent; these are not presented as ordinary Marketing source accounts.

Runtime Windsor discovery/connect-info remains authoritative for availability/authentication rather than hard-coded credential forms.

## 5. Amazon Seller Central and eBay commercial profiles

Point 12 adds curated field/KPI profiles instead of attempting to ingest hundreds of fields by default.

### Amazon Seller Central (Amazon SP)

Profiles:

- **Orders & revenue** — order ID/date, ASIN/product, quantity, item price/tax/currency, status, sales channel and fulfilment channel. KPI projection includes order revenue, distinct orders and units.
- **FBA inventory health** — SKU/ASIN, fulfilable/reserved/total/unsellable quantities, recent sales/shipments and sell-through. KPI projection includes fulfilable units, 30-day shipped units and sell-through.

### eBay

Profiles:

- **Orders & seller proceeds** — order state, totals, seller proceeds, marketplace fees, refunds and buyer geography. KPI projection includes gross sales, seller proceeds, marketplace fees and distinct orders.
- **Listing traffic & conversion** — impressions, views, click-through, sales conversion and transactions.
- **Promoted Listings** — campaign, impressions, clicks, attributed sales, ad fees and ROAS.

Profiles are defaults, not schema authority: live Windsor field discovery remains available and custom fields may be used where appropriate.

## 6. Data Hub ingestion and scheduling

Connected accounts import into existing canonical Marketing Data Core storage:

`MarketingDataSource -> MarketingRawRecord -> MarketingNormalisedRecord -> lineage -> sync runs -> connector health`

No Windsor-only reporting database is introduced.

The customer UI can configure:

- Manual;
- Hourly;
- Daily;
- Weekly.

Scheduled Windsor sources reuse the existing `marketingDataSyncWorkerService`. The worker uses the source checkpoint watermark for incremental date windows and the same location ownership, concurrency, retry and health contracts as other Marketing Data sources.

Production worker activation remains an explicit operations step controlled by environment configuration; source support does not silently start a production worker.

## 7. Historical backfill / high-cardinality safety

Because Point 12 does not assume an undocumented general offset/pagination contract, historical import uses **adaptive date slicing**:

1. a requested historical period is divided into bounded date slices;
2. each Windsor request is capped at 100 rows;
3. if a slice reaches the cap, the slice is recursively subdivided;
4. subdivision stops at one-day windows;
5. if a one-day window still reaches the cap, the date is recorded in `saturatedDays` and the response returns `complete: false` rather than pretending the history is complete.

Commercial guardrails:

- maximum single backfill range: 366 days;
- default initial slice: 7 days; configurable up to 31 days;
- maximum 120 Windsor requests in one backfill operation;
- backfill preserves the normal incremental-sync checkpoint rather than moving it backwards.

A connector/day that remains saturated after one-day slicing requires connector-specific investigation before historical completeness is accepted.

## 8. Windsor API rate-budget protection

A persistent Mongo-backed usage budget protects all application instances against exceeding provider-wide usage by accident.

Documented external ceilings represented in source:

- 600 requests/minute;
- 10,000 requests/day.

Default AIIBP budgets retain headroom:

- 540 requests/minute;
- 9,000 requests/day.

Optional server overrides:

- `WINDSOR_REQUESTS_PER_MINUTE`;
- `WINDSOR_REQUESTS_PER_DAY`.

Minute/day counters are persistent and TTL-cleaned. Requests fail closed with `WINDSOR_RATE_BUDGET_EXHAUSTED` when a configured budget is exhausted. Import, scheduled sync and historical backfill use the shared budget contract.

## 9. Customer UI

`/marketing` remains the single allocatable Marketing module. Windsor is an internal workspace.

For each connected source account, the customer can:

- search/filter connectors;
- securely connect/reconnect through provider-hosted authentication;
- reconcile/check linked accounts;
- preview data;
- choose a curated data profile where available;
- create/update the active Location Data Hub source;
- choose manual/hourly/daily/weekly automatic sync;
- run bounded historical import by date range;
- see source profile/cadence/status;
- load seller KPI summaries for seller connectors;
- disconnect a linked account.

Data Hub source mappings are returned on page reload, so the UI remains operable after the initial import rather than relying on transient browser state.

## 10. Seller KPI evidence

Seller dashboard summaries consume `MarketingNormalisedRecord`, not a direct live Windsor response. KPI calculation is Business + Location + Data Hub source scoped and uses the selected seller profile.

The initial read model considers up to 10,000 normalized records and reports when that bound is reached so the UI does not imply an unbounded/exhaustive result. This is a commercial acceptance baseline; larger aggregate/materialized views can be introduced later without changing the ingestion authority.

## 11. AI assistance boundary

AI may assist with connector discovery/setup explanation, source recommendation, field/mapping suggestions, connection-health diagnosis, data-quality/anomaly explanation, metric interpretation, seller/marketing summaries and proposed commercial actions.

AI must not:

- obtain/display provider passwords;
- reveal Windsor/team/session secrets;
- cross Business or Location boundaries;
- connect/unlink an account autonomously;
- perform Windsor/provider write actions automatically;
- replace normalized deterministic evidence as the source of truth.

Any future write-capable provider workflow requires explicit permission, policy, approval, audit and rollback contracts.

## 12. Validation

Dedicated workflow: **Point 12 Marketing Windsor Gate**.

The gate validates:

- distinctive module boundaries;
- requested connector/seller classification;
- documented Windsor query parameters;
- tenant-owned account and source enforcement;
- curated Amazon/eBay profiles;
- Data Hub source/profile/schedule contracts;
- scheduled sync checkpoint and rate-budget integration;
- persistent provider usage budgeting;
- adaptive backfill/saturation handling;
- seller KPI projection from normalized evidence;
- route permission contracts;
- frontend commercial operations workflow;
- backend source/application import checks;
- production frontend build and bundle budget.

At the final Point 12 commercial-readiness head, both backend and frontend jobs of this gate are green.

## 13. Commercial activation checklist

Source development is complete for the acceptance baseline. Before enabling a tenant in production:

1. configure `WINDSOR_API_KEY` through the production secret/environment process;
2. confirm the commercial Windsor plan and refresh limits for expected tenant/account volumes;
3. verify access-token-bearing URLs are not captured by application/proxy/APM logs;
4. perform Business A vs Business B and Location A vs Location B isolation tests;
5. connect representative live providers, including Amazon Seller Central and eBay where commercially required;
6. validate returned live field names against curated profiles and adjust mappings if Windsor schema differs;
7. test preview, source import, scheduled cadence, backfill saturation reporting and disconnect;
8. validate seller KPI values against provider-native reports for the acceptance period;
9. confirm source-data privacy/retention and applicable provider terms;
10. run HCI/accessibility/manual browser acceptance on the Marketing workflow;
11. only then enable the Marketing Data sync worker for approved production tenants;
12. retain all provider write-capable actions disabled until a separate approved implementation exists.

**No production Windsor credential, live provider connection, worker activation, production historical backfill or provider write action is performed by this source-development closure.**
