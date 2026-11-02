# Point 12 — Marketing Module Acceptance Status

**Roadmap authority:** `docs/MASTER_DEVELOPMENT_ROADMAP_v3.2.md`  
**Acceptance checklist:** `docs/roadmap/point12-business-module-boundaries.md`  
**Scope:** Marketing module and its governed Data Connections / seller evidence workflows only.

## Status rules

- **Source complete** — required implementation and automated source contracts exist.
- **CI verified** — the relevant Point 12 contract/build gate has passed on the current branch head.
- **Manual pending** — browser/provider acceptance still requires an approved non-production Business, Location and/or provider account.
- **Production deferred** — no production credentials, provider writes, workers, backfills or activation are authorised by source completion.

## B — Marketing module navigation

**Status:** Source complete; CI verification required on current head; manual browser acceptance pending.

Implemented Marketing workspaces:
- Data connections;
- Native connections;
- Sellers;
- Journeys & automation;
- Attribution & performance;
- AI marketing assistance.

The Marketing landing page retains CRM, Communications and Analytics as canonical authorities rather than duplicating them.

## C — Managed Data Connections without adapter configuration

**Status:** Source complete; CI verification required on current head; manual browser acceptance pending.

Automated contracts verify:
- the AIIBP connection catalogue remains visible when the managed adapter is not configured;
- an explicit not-configured state is rendered;
- connect actions fail closed while runtime configuration is absent;
- adapter/API secrets are server-side and are not referenced through browser `VITE_*` configuration.

## D — Managed source connection

**Status:** Source complete for the AIIBP contract; provider acceptance pending.

Implemented and protected:
- `Connect securely` starts a server-generated authorization flow in a new tab;
- the browser is not asked for an ordinary provider password;
- temporary reconciliation credentials are retained server-side through the provider credential store;
- authorization API responses expose the authorization URL but not the stored reconciliation token as a response field;
- account reconciliation is bound to the active Business-owned `IntegrationConnection`;
- preview/import/unlink reject accounts not reconciled to the active Business;
- Marketing sources require the `marketing` entitlement;
- seller connectors require the independent `seller-marketplace` entitlement;
- the shared catalogue can be opened by either entitlement without duplicating the workspace.

Manual acceptance still requires an approved non-production adapter and test provider account.

## E — Amazon Seller Central

**Status:** Source complete for provider-neutral AIIBP workflow; provider acceptance pending.

Automated contracts verify:
- `Amazon Seller Central (Amazon SP)` remains a Seller connector;
- governed Orders & revenue and FBA inventory profiles exist;
- imports require Business/Location ownership and create/update the canonical Data Hub source;
- Manual / Hourly / Daily / Weekly cadence choices are supported;
- imported seller sources are read-only;
- Seller KPI projection reads only Business/Location-owned normalised evidence;
- bounded history import and saturation handling remain part of the shared Data Connection contract;
- no listing/product/payout write client is exposed.

Provider-native KPI reconciliation remains manual.

## F — eBay

**Status:** Source complete for provider-neutral AIIBP workflow; provider acceptance pending.

Automated contracts verify:
- eBay remains a Seller connector;
- Orders, Traffic and Promoted Listings profiles exist;
- the same Business/Location, read-only, cadence, Data Hub, history and KPI boundaries used by Amazon apply to eBay;
- no provider listing or payout mutation client is exposed.

Provider-native KPI reconciliation remains manual.

## G — Data Hub ingestion and scheduling

**Status:** Source complete; CI verification required on current head; scheduled-worker production activation deferred.

Automated contracts verify:
- Location is required for import;
- imports reuse the canonical Marketing Data Core;
- Business/Location/source key upsert updates an existing Data Hub source rather than creating a duplicate;
- Manual / Hourly / Daily / Weekly cadence is canonical;
- automatic cadences populate `nextRunAt` while Manual does not;
- the shared Marketing Data Sync Worker executes due managed sources;
- worker source updates and retry scheduling retain Business and Location ownership;
- managed scheduled sync retains the existing incremental checkpoint and remains read-only.

## H — Historical backfill safety

**Status:** Source complete; CI verification required on current head; provider/manual acceptance pending.

Automated contracts verify:
- a single historical operation is date-bounded and capped at 366 days;
- initial windows are sliced and saturated windows are recursively subdivided;
- one-day saturation is explicitly reported and prevents a false `complete` result;
- per-operation request count is capped and shared API request-budget reservation is enforced;
- historical runs reuse the original incremental watermark rather than moving the normal checkpoint backwards;
- backfill remains Business/Location scoped and read-only.

## I — Destinations and AI destinations

**Status:** Source complete; manual UI acceptance pending.

Automated contracts verify:
- ChatGPT, Claude and Copilot Agent are represented as AI destinations;
- Power BI is represented as a destination;
- destination/AI-destination entries are explicitly identified as downstream destinations, not Marketing sources;
- source connect/import operations are not rendered for destination-only entries;
- destination activation remains separate from source ingestion.

## J — Native versus managed connections

**Status:** Source complete; manual UI/provider-mode acceptance pending.

Automated contracts verify:
- the Marketing landing page exposes separate `Data connections` and `Native connections` workspaces;
- managed source operations remain within the provider-neutral Data Connections surface;
- native connections use the shared AIIBP Connection Framework;
- the shared managed catalogue is reused by Marketing and Seller Marketplace without creating a duplicate commercial workspace/module.

## K — CRM separation

**Status:** Source complete; manual consent-change acceptance pending.

Automated contracts verify:
- Marketing/retention analysis reads canonical `Customer` and `ConsentRecord` state;
- email, SMS and WhatsApp contactability is derived from canonical consent/preferences/suppression state;
- the CRM projection does not create or mutate a parallel `ConsentRecord` authority;
- next-best-action output remains advisory with `executionAuthorised: false`.

## L — Communications separation

**Status:** Source complete; manual delivery-workflow acceptance pending.

Automated contracts verify:
- journey enrollment consumes canonical CRM evidence;
- Marketing journey steps are created as non-executable evidence (`execution_not_authorised`);
- Marketing journey code does not directly invoke SendGrid/Twilio or create delivery records;
- campaign, template, scheduling and delivery routes remain owned by the `communications` commercial entitlement and Communications RBAC.

## M — Analytics and AI assistance

**Status:** Source complete; manual BI/provider reconciliation and AI UI acceptance pending.

Automated contracts verify:
- deterministic seller KPI projections read Business/Location/source-scoped `MarketingNormalisedRecord` evidence;
- Marketing AI declares `aiibp_data_hub` as its evidence authority;
- Marketing AI is advisory, requires human approval and has external writes disabled;
- forecast execution and automatic promotion remain disabled;
- the UI route is protected by `ai:use` and its client consumes the read-only Marketing insights endpoint.

## N — Disconnect/unlink

**Status:** Source complete; provider/manual acceptance pending.

Automated contracts verify:
- unlink resolves the active Business-owned connection first;
- the target account must already belong to that Business;
- unlink invokes only the external managed-account unlink operation and then reconciles the Business connection;
- unlink does not delete `MarketingDataSource` historical evidence;
- the browser client exposes no hidden historical-data purge endpoint as part of account unlink.

## Current source acceptance outcome

Roadmap B–N now has explicit automated source contracts. This does **not** mean provider/manual acceptance is complete. The remaining Marketing acceptance work is evidence collection using an approved non-production Business/Location and provider test accounts, followed by CI confirmation on the current branch head.

## Production boundary

This status record does not authorise production provider credentials, provider writes, scheduled-worker activation, production historical backfill, deployment, or model/AI action activation.
