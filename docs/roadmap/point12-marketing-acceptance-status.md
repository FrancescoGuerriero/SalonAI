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

**Status:** Source implementation exists; acceptance contract review is next.

Next verification slice:
- Location required for import;
- canonical Marketing Data Core reuse;
- existing Data Hub source update instead of duplication;
- `nextRunAt` for automatic cadences;
- shared sync worker execution;
- retry/error evidence remains Business/Location scoped.

## H — Historical backfill safety

**Status:** Source implementation exists; acceptance contract review follows G.

Next verification slice:
- date-bounded slicing;
- saturated-window subdivision;
- explicit one-day saturation reporting;
- request-budget enforcement;
- incremental checkpoint is not moved backwards.

## I–N

Not yet accepted in this pass. Continue strictly in roadmap order after G/H:

- I — Destinations and AI destinations;
- J — Native versus managed connections;
- K — CRM separation;
- L — Communications separation;
- M — Analytics and AI assistance;
- N — Disconnect/unlink.

## Production boundary

This status record does not authorise production provider credentials, provider writes, scheduled-worker activation, production historical backfill, deployment, or model/AI action activation.
