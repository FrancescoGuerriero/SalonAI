# Stage 8 — AIIBP Data Hub foundation

Date: 2026-10-25  
Authority: historical Stage 8 implementation record; superseded for forward execution by AIIBP Master Development Roadmap v3.2.  
DEV owner: DEV1.

## Purpose

Stage 8 established the canonical BI/evidence layer required before broader AI Adviser, predictive ML, recommendation and Natural Computing work. The Data Hub is a first-party AIIBP capability for connecting tenant-owned evidence, blending cross-source facts, building reusable BI views and providing governed evidence to downstream AI features.

The Stage-5 Marketing Data Core remains the ingestion authority. Stage 8 consumes its tenant-owned `MarketingDataSource`, immutable raw records, `MarketingNormalisedRecord` lineage and integration credential authority rather than introducing a second connector framework.

## Implemented in this foundation slice

1. **Unified Data Hub catalogue**
   - reuses the AIIBP source connector catalogue;
   - exposes destination-task contracts for Sheets, Excel, BigQuery, Snowflake, PostgreSQL, MySQL, S3, Azure Blob, Azure SQL, Redshift, Databricks, Power BI, Looker Studio, Tableau, Python/API and governed AI evidence consumers;
   - distinguishes implemented source contracts from planned adapters.

2. **Cross-source query and blend contract**
   - Business-scoped reads over `MarketingNormalisedRecord` only;
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
   - secrets remain in the existing credential authority;
   - live execution is separately governed and human approval is mandatory where required.

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

## Source-adapter expansion rule

Provider adapters must extend AIIBP Integration Hub / Data Connection / `MarketingDataSource` contracts and preserve raw + normalised lineage. They must not create parallel ingestion stores or independent tenant/credential authorities.

Representative source categories include advertising, organic social, local/search, commerce, payments and CRM platforms. Provider names identify integration targets only; AIIBP remains the platform authority.

## Safety and tenancy rules

- All Data Hub persistent objects are Business-owned and Location-scoped where applicable.
- Query sources must belong to the active trusted context.
- Query field references are allowlisted and cannot inject Mongo operators.
- Queries are bounded to a maximum record scan and result size.
- Destination metadata rejects credential/token/password/API-key fields.
- Destination write execution remains separately governed.
- AI evidence cannot authorise provider writes or consequential actions by itself.
- Existing attribution, finance, CRM, communications and operational domains remain authoritative for their facts.

## Explicitly not activated by this historical foundation slice

- production provider credentials;
- autonomous external destination exports;
- production historical backfills;
- unapproved provider write actions;
- unrestricted tool execution;
- AI model promotion, training, retraining or production inference changes;
- production migration or deployment.

These require explicit provider-specific and production release gates.

## Stage 8 continuation

The Data Hub established the evidence layer for later work including:

1. canonical BI metric/dimension expansion;
2. AI Gateway/tool registry;
3. governed Python AI APIs and experiment/dataset/model conventions;
4. RBAC-aware knowledge ingestion and RAG;
5. AI Adviser and Management Copilot consuming Data Hub evidence;
6. predictive ML with deterministic/statistical baselines;
7. explainable recommendations;
8. MLOps/lineage/monitoring;
9. Natural Computing only after predictive/AI/baseline optimisation maturity gates are met.

For current modular SaaS execution, use `docs/MASTER_DEVELOPMENT_ROADMAP_v3.2.md` and the Point 12 module/data-connection acceptance records.
