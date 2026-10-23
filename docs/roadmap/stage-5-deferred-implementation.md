# Stage 5 deferred implementation and activation record

Authority: AIIBP Roadmap v3.0, Stage 5 — SEO, measurement & integration core, including the retained v2.9 Marketing Data Core requirements.

This record separates source-complete Stage 5 platform contracts from provider/production activation work that must not be performed implicitly.

## Implemented / already present

### Existing integration core retained and reused

- tenant-scoped `IntegrationApp` registry and connection model;
- versioned integration scope catalogue;
- encrypted credential versions with one-time secret return, overlap/retirement and revocation;
- versioned domain-event catalogue;
- webhook subscriptions, signed delivery projection, retry/replay and connector health;
- integration API authentication and per-app rate limiting;
- canonical metric catalogue with versioned definitions, formulas, permissions and evidence/source fields.

### Completed for Stage 5

- explicit versioned API rate-limit contract and `X-RateLimit-Policy-Version` response header;
- consolidated Stage-5 contract catalogue exposing metric, event, scope, connector and rate-limit versions;
- Marketing Data Core source model linked to the existing IntegrationApp/IntegrationConnection authority;
- provider contracts for GA4, Google Search Console, Bing Webmaster Tools, generic structured sources and technical SEO;
- no-code source onboarding metadata, field catalogue/mapping contract and data preview;
- manual, scheduled, incremental and backfill run contracts with checkpoints/watermarks;
- immutable raw record store plus normalised records with raw-record lineage and provider/mapping schema versions;
- reconciliation counts and deduplication by source/external ID/payload hash;
- sync run status/failure evidence, retry metadata and connector-health projection;
- bounded technical SEO crawler covering HTTP status, title, meta description, canonical, robots/noindex, H1s and internal links;
- crawler controls for HTTPS-only URLs, public DNS addresses, same-origin navigation, redirect/page/response-size bounds and request timeout;
- Stage-5 management workspace for contract versions, source onboarding, preview, connector health, sync runs and webhook observability.

## Deferred / skipped for later activation

### 1. Live GA4 OAuth activation

**Status:** provider schema, scopes, source contract, preview and ingestion pipeline are implemented. No Google Analytics account is connected by this change.

Later activation requires an approved Google Cloud OAuth client, business consent, least-privilege `analytics.readonly`, encrypted credential storage through IntegrationApp, property selection and a controlled acceptance run. Do not place OAuth tokens in `MarketingDataSource.sourceConfig`.

### 2. Live Google Search Console activation

**Status:** Search Console provider contract and normalisation fields are implemented; live provider retrieval is intentionally inactive.

Later activation requires approved Google OAuth credentials, verified site/property selection and an acceptance run against an authorised property.

### 3. Live Bing Webmaster activation

**Status:** Bing provider contract and normalisation fields are implemented; live provider retrieval is intentionally inactive.

Later activation requires an approved provider credential/connection and an authorised site. Credentials remain in IntegrationApp credential versions, never source metadata.

### 4. Production scheduler / worker activation

**Status:** source cadence, next-run metadata, scheduled/incremental/backfill run modes, checkpoints and retry evidence exist at source level.

A production scheduler/queue must be activated only after worker capacity, concurrency, provider quotas, retry policy and operations ownership are approved. Do not turn on recurring external-provider pulls merely by merging Stage 5.

### 5. Production historical backfill

**Status:** `backfill` is a supported run contract, but no historical provider data is imported here.

Any production backfill requires an explicit date window, dry-run volume estimate, quota/cost review, reconciliation thresholds and rollback/cleanup plan.

### 6. Production technical SEO crawling

**Status:** the bounded scanner is implemented but no real production site is crawled by this change.

Before recurring production crawling, approve target origins, crawl cadence, page limit, robots/policy expectations, network egress controls and operational ownership.

### 7. Provider-specific quota tuning and pagination workers

**Status:** the IntegrationApp rate-limit contract governs inbound partner API access; external-provider quotas remain provider-specific.

When live adapters are activated, add provider pagination/request executors behind the existing source contract and honour provider retry/backoff headers without changing raw/normalised lineage semantics.

### 8. Production credential rotation

**Status:** credential versioning and rotation mechanics already exist. No live credential is issued, rotated or revoked here.

Production credential operations require explicit approval and provider-side coordination where applicable.

### 9. Production webhook signing-secret provisioning

**Status:** webhook subscription/delivery infrastructure already supports governed signing credentials. No production signing secret is provisioned or rotated here.

### 10. Production release/deployment

**Status:** source implementation only until PR, CI and security gates complete.

Required later sequence: green PR Fast CI and CodeQL → merge to `main` → post-merge checks → immutable release/tag evidence → explicitly authorised production deployment → production smoke/P0 verification.

## Re-entry rule

Before implementing a deferred item, audit current `main` and confirm the provider/business dependency. Extend the existing IntegrationApp, Marketing Data Core, event/webhook and metric authorities; do not introduce parallel connector, secret, event, metric or ingestion frameworks.
