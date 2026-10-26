# Point 12 — Marketing Automation

Original Phase 14.

## Decision

Point 12 extends the existing business-facing **Marketing** module. It does not introduce a second marketing product and does not rebuild CRM, Communications, Data Hub, campaign/attribution or AI foundations.

The existing first-party Windsor-style/provider-neutral marketing-data capability remains an internal engine. Businesses are allocated the **Marketing** module, while internal dependencies are installed/resolved by the platform.

## Foundations reused

- Stage 5 Marketing Data Core / Data Hub for provider-neutral ingestion, normalisation and lineage.
- Stage 6 `Campaign`, `CampaignExecution`, social publishing and deterministic attribution.
- Stage 7 Customer 360, lifecycle, deterministic segmentation, consent-aware journeys and campaign-to-revenue evidence.
- Communications for templates, delivery, retries and scheduled messages.
- Integration Hub for external platform connections and credential governance.
- Analytics & BI for deterministic metrics and reporting.
- Governed AI platform and business-facing AI assistants for advisory recommendations.

## Canonical module authority

Module definitions and non-duplication rules are encoded in:

- `backend/src/platform/capabilities/capabilityRegistry.js`
- `backend/src/platform/capabilities/verticalPackRegistry.js`
- `docs/architecture/business-module-boundaries.md`

Every active canonical `ownedDomain` has at most one owner. Tenant/business configuration should expose `allocatableCapabilityPackKeys` rather than internal engines.

## Marketing composition

The single business-facing `marketing` module composes three internal, non-allocatable engines:

1. `marketing-data` — Windsor-style/provider-neutral ingestion, normalisation and lineage.
2. `campaigns-attribution` — campaigns, campaign executions, social publication and deterministic attribution.
3. `marketing-automation` — triggers, approval policy, scheduling and automation-run evidence.

It also consumes existing authorities:

- provider connections/credentials — Integration Hub;
- customer lifecycle/segments/retention definitions — CRM & Customer Intelligence;
- message transport/templates/delivery state — Communications;
- deterministic metrics — Analytics & BI;
- recommendations/predictions — AI assistant modules;
- orders/payments/appointments/staff/services — their canonical operational domains.

## Point 12 implementation direction

New source work should focus on the Marketing module experience and orchestration:

- marketing overview and dependency/readiness state;
- campaign/journey trigger configuration;
- audience preview using canonical CRM segments and consent/contactability;
- approval workflow;
- schedule controls;
- execution evidence;
- attribution/ROI evidence;
- AI-assisted recommendations that remain advisory;
- clear links to Integration Hub, Communications, CRM and Analytics without duplicating those functions.

## Safety boundary

Marketing execution remains human-approved by default. Provider credentials, production sending, autonomous scheduling, production data migration, model promotion and production activation remain controlled steps and are not enabled merely by allocating the Marketing module.

Manual acceptance is defined in `docs/roadmap/point12-business-module-boundaries.md`.
