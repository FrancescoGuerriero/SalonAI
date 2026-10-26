# Point 12 — Marketing Automation

Original Phase 14.

## Decision

Point 12 extends the existing **Marketing** module rather than creating another marketing product. The business-facing Marketing module composes provider connectivity, Windsor-backed data ingestion, seller data, campaigns/attribution, CRM audiences, consent-aware automation, Communications delivery, deterministic BI and governed AI assistance.

The existing first-party/provider-neutral Marketing Data Core remains canonical inside AIIBP. Windsor is an external connector platform feeding that Data Hub; it does not become the source of truth for campaigns, customers, permissions, tenant ownership or business configuration.

## Distinct internal authorities

- **Integration Hub** — provider/native connection and credential authority.
- **Windsor connector layer** — broad read/analytics authorization and source-account retrieval.
- **Marketing Data Core / Data Hub** — canonical AIIBP ingestion, raw/normalised lineage and source health.
- **CRM** — Customer 360, lifecycle, segmentation and consent/contactability evidence.
- **Campaign & Attribution Engine** — canonical campaign/execution/attribution evidence.
- **Marketing Automation Engine** — triggers, approval, schedule and automation-run evidence.
- **Communications** — message templates, transport, delivery status and retry.
- **Analytics & BI** — deterministic reporting/read models.
- **AI assistants** — advisory interpretation/recommendation; humans remain decision owners.

## Windsor plugin delivered in this Point 12 branch

- metadata-driven requested connector catalogue;
- runtime Windsor connector discovery/connect-info contract;
- server-side `WINDSOR_API_KEY` only;
- Business-scoped Windsor authorization sessions;
- encrypted session token storage;
- account reconciliation scoped to the specific Business authorization session;
- Business-owned account ID enforcement before preview/import/unlink;
- one Marketing landing workspace with Windsor and native sub-workspaces;
- separate UI groups for Sources, Sellers, Data platforms, Destinations and AI destinations;
- dedicated Sellers experience including Amazon Seller Central and eBay;
- read-only preview;
- bounded manual import into the canonical location-owned Data Hub;
- destination-only entries blocked from ordinary source import;
- no Windsor/provider write operations enabled.

## Seller direction

Amazon Seller Central (`amazon_sp`) and eBay (`ebay`) are treated as **Sellers** inside Marketing. Their analytics evidence can flow through Windsor into the Data Hub and then into BI/AI. Product/listing mutations, finance actions or other provider writes require future explicit provider-specific authorization, permission, approval and audit contracts.

## AI role

AI may assist the user with connector selection, setup explanations, connection-health interpretation, field/mapping suggestions, anomaly/data-quality interpretation and marketing/seller insight generation from canonical Data Hub evidence.

AI does not receive provider passwords or Windsor API/session tokens and cannot silently connect/unlink accounts, cross tenant boundaries, execute provider write actions or replace deterministic evidence with model output.

## Ingestion activation boundary

The first implementation supports bounded manual import to prove the connection, tenant isolation and canonical Data Hub lineage. Complete scheduled/incremental/backfill ingestion requires connector-specific validation of Windsor fields, pagination, date windows, limits, retry behaviour and commercial refresh limits. It must reuse the same canonical `MarketingDataSource` rather than introduce another store.

## Manual acceptance

Use:

- `docs/roadmap/point12-business-module-boundaries.md`
- `docs/roadmap/point12-windsor-connector-implementation.md`

These include Business/module allocation, Windsor configuration, Amazon/eBay seller tests, Data Hub import, native-vs-Windsor boundaries, CRM/Communications separation, AI boundaries and cross-tenant unlink/import checks.

## Production safety

No production deployment, live provider credential activation, scheduled Windsor sync, historical backfill, provider write operation, autonomous marketing send, model promotion or production AI decision authority is authorised by this source implementation.
