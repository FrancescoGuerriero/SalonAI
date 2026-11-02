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

## I–N

Not yet accepted in this pass. Continue strictly in roadmap order after H:

- I — Destinations and AI destinations;
- J — Native versus managed connections;
- K — CRM separation;
- L — Communications separation;
- M — Analytics and AI assistance;
- N — Disconnect/unlink.

## Production boundary

This status record does not authorise production provider credentials, provider writes, scheduled-worker activation, production historical backfill, deployment, or model/AI action activation.
