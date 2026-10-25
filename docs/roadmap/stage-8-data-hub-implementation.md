# Stage 8 — AIIBP Data Hub foundation

Date: 2026-10-25  
Authority: AIIBP Master Development Roadmap v2.9, Stage 8.  
DEV owner: DEV1.

## Purpose

Stage 8 begins by establishing the canonical BI/evidence layer required before broader AI Adviser, predictive ML, recommendation and Natural Computing work. The Data Hub is a first-party AIIBP capability inspired by the functional category served by managed ELT/BI products such as Windsor.ai, but it does not copy third-party source code, proprietary schemas, branding or user-interface assets.

The Stage-5 Marketing Data Core remains the ingestion authority. Stage 8 consumes its tenant-owned `MarketingDataSource`, immutable raw records, `MarketingNormalisedRecord` lineage and integration credential authority rather than introducing a second connector framework.

## Implemented in this foundation slice

1. **Unified Data Hub catalogue**
   - reuses the Stage-5 source connector catalogue;
   - exposes destination-task contracts for Sheets, Excel, BigQuery, Snowflake, PostgreSQL, MySQL, S3, Azure Blob, Azure SQL, Redshift, Databricks, Power BI, Looker Studio, Tableau, Python/API and AI/MCP evidence consumers;
   - distinguishes implemented source contracts from planned adapters.

2. **Cross-source query and blend contract**
   - business-scoped reads over `MarketingNormalisedRecord` only;
   - bounded scan and row limits;
   - selectable sources, entity types, date grain, dimensions, metrics and filters;
   - deterministic aggregation;
   - calculated CTR, CPC, CPM, CPA, ROAS and conversion-rate metrics from canonical base facts;
   - provider/source/schema provenance returned with every result.

3. **Reusable BI saved views**
   - tenant-owned saved query definitions;
   - active/draft/archive lifecycle;
   - reusable by management reporting, destinations and AI evidence.

4. **Destination task contracts**
   - tenant-owned destination definitions and cadence metadata;
   - field mapping, format and write-mode contracts;
   - optional canonical IntegrationApp/IntegrationConnection linkage;
   - secrets are rejected from destination metadata and remain in the existing credential authority;
   - live execution defaults to false and human approval is mandatory.

5. **Destination preview and evidence ledger**
   - deterministic preview generation from a saved view;
   - preview checksum and row-count evidence;
   - no external write during preview;
   - auditable preview run ledger.

6. **AI evidence API**
   - returns canonical rows, totals and provenance rather than allowing AI to recompute competing business truths;
   - marks deterministic baseline, evidence requirements and action-authorisation policy;
   - external write actions are disabled by default.

7. **Management workspace**
   - task-oriented Data Hub UI under `/admin/system/data-hub`;
   - cross-source query builder;
   - saved BI views;
   - destination-task creation and preview;
   - source/destination catalogue visibility;
   - provenance and governance status.

## Initial source-adapter backlog

The first adapter backlog is intentionally metadata-only until provider credentials, schemas, quotas and acceptance tests are implemented behind the existing Stage-5 connector authority:

- Google Ads
- Meta Ads
- LinkedIn Ads
- Microsoft Advertising
- TikTok Ads
- Instagram Organic
- Facebook Pages
- LinkedIn Pages
- Google Business Profile
- Shopify
- Stripe
- HubSpot
- Mailchimp
- YouTube Analytics

Adding a provider must extend `MarketingDataSource`/IntegrationApp contracts and preserve raw + normalised lineage. It must not create a parallel ingestion store.

## Safety and tenancy rules

- All Data Hub persistent objects are Business-owned.
- Query sources must belong to the active Business.
- Query field references are allowlisted and cannot inject Mongo operators.
- Queries are bounded to a maximum record scan and result size.
- Destination metadata rejects credential/token/password/API-key fields.
- Destination execution is `false` by default and this slice contains no live destination writer.
- AI evidence cannot authorise provider writes or consequential actions.
- Existing attribution, finance, CRM, communications and operational domains remain authoritative for their facts.

## Explicitly not activated by this slice

- live Google/Meta/LinkedIn/TikTok/commerce/CRM provider credentials;
- autonomous external destination exports;
- scheduled destination workers;
- production backfills;
- provider write actions such as pausing campaigns or changing budgets;
- unrestricted MCP tool execution;
- AI model promotion, training, retraining or production inference changes;
- production migration or deployment.

These require explicit provider-specific and production release gates.

## Stage 8 continuation after this slice

The Data Hub establishes the evidence layer for the remaining Stage-8 programme:

1. canonical BI metric/dimension catalogue expansion beyond marketing;
2. AI Gateway/tool registry;
3. governed Python AI API and experiment/dataset/model conventions;
4. RBAC-aware knowledge ingestion and RAG;
5. AI Adviser and Management Copilot consuming Data Hub evidence;
6. predictive ML with deterministic/statistical baselines;
7. explainable recommendations;
8. MLOps/lineage/monitoring;
9. Natural Computing only after the predictive/AI Adviser/baseline optimisation maturity gates are met.

The Data Hub is therefore the Stage-8 BI/evidence foundation, not the completion of all AI-1..AI-12 or NC-1..NC-10 work.
