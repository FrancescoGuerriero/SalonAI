# Point 12 — Marketing Automation

Original Phase 14.

## Decision

Point 12 extends the existing **Marketing** module rather than creating another marketing product. The business-facing Marketing module composes provider connectivity, AIIBP-managed data connections, seller data, campaigns/attribution, CRM audiences, consent-aware automation, Communications delivery, deterministic BI and governed AI assistance.

The provider-neutral Marketing Data Core remains canonical inside AIIBP. External providers and optional managed connection adapters feed the Data Hub; they do not become the source of truth for campaigns, customers, permissions, tenant ownership or business configuration.

## Distinct internal authorities

- **Integration Hub** — provider connection and credential authority.
- **AIIBP Data Connections** — provider-neutral native/managed connection experience and source-account mapping.
- **Marketing Data Core / Data Hub** — canonical ingestion, raw/normalised lineage and source health.
- **CRM** — Customer 360, lifecycle, segmentation and consent/contactability evidence.
- **Campaign & Attribution Engine** — canonical campaign/execution/attribution evidence.
- **Marketing Automation Engine** — triggers, approval, schedule and automation-run evidence.
- **Communications** — message templates, transport, delivery status and retry.
- **Analytics & BI** — deterministic reporting/read models.
- **AI assistants** — advisory interpretation/recommendation; humans and canonical operational modules remain decision/action authorities.

## Data connection capability delivered in Point 12

- metadata-driven connection catalogue;
- provider-neutral managed adapter gateway plus existing native adapters;
- server-side credential/configuration only;
- Business-scoped authorization sessions;
- encrypted session credential storage;
- account reconciliation scoped to the active Business;
- Business-owned account enforcement before preview/import/unlink;
- Location-owned Data Hub source enforcement;
- one Marketing landing workspace with Data Connections and Native Connections sub-workspaces;
- separate Sources, Sellers, Data platforms, Destinations and AI destinations;
- seller experience including Amazon Seller Central and eBay;
- curated seller data/KPI profiles;
- read-only preview;
- canonical Data Hub import;
- Manual / Hourly / Daily / Weekly sync cadence;
- shared scheduled sync worker;
- adaptive bounded historical backfill;
- persistent request-budget protection;
- seller KPI projection from normalised Data Hub evidence;
- no automatic provider write operations.

## Seller direction

Amazon Seller Central (`amazon_sp`) and eBay (`ebay`) are treated as **Sellers** inside Marketing. Their analytics and operational evidence can flow into the Data Hub and then into BI/AI. Product/listing mutations, finance actions or other provider writes require explicit provider-specific authorization, permission, approval, audit and rollback contracts.

## AI role

AI may assist with connection selection, setup explanations, connection-health interpretation, field/mapping suggestions, anomaly/data-quality interpretation and marketing/seller insight generation from canonical Data Hub evidence.

AI does not receive ordinary provider passwords, reveal server-side connection credentials, silently connect/unlink accounts, cross tenant boundaries, execute unapproved provider write actions or replace deterministic evidence with model output.

## Ingestion boundary

Managed and native sources must reuse canonical `MarketingDataSource` and Marketing Data Core contracts rather than introducing adapter-specific stores.

Historical ingestion uses bounded adaptive date windows. If a one-day window still reaches the configured row cap, the operation reports saturation and does not claim historical completeness. Scheduled ingestion uses the shared Marketing Data Sync Worker, checkpoint watermark and tenant/location controls.

## Module packaging boundary

Marketing is one commercial module. `marketing-data`, `campaigns-attribution` and `marketing-automation` remain internal capabilities. When a tenant selects Marketing, `moduleInstallationResolver.js` automatically resolves these internal engines and their dependencies rather than requiring the Business to configure them as separate products.

## Manual acceptance

Use:

- `docs/roadmap/point12-business-module-boundaries.md`
- `docs/roadmap/point12-managed-data-connections.md`
- `docs/architecture/business-module-boundaries.md`

These cover Business/module allocation, dependency resolution, provider configuration, Amazon/eBay seller tests, Data Hub import/scheduling/backfill, native-vs-managed boundaries, CRM/Communications separation, AI boundaries and cross-tenant isolation.

## Production safety

Source support does not itself authorise production activation. Production credentials, live provider connections, enabling background sync workers, production historical imports, provider write operations, autonomous marketing sends, model promotion and production AI decision authority remain explicit controlled operations.
