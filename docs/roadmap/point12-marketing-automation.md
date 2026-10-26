# Point 12 — Marketing Automation

Original Phase 14.

## Decision

Point 12 does not rebuild the existing marketing, CRM, communications, Data Hub, campaign or AI foundations. It composes them into distinct allocatable business modules with explicit authority boundaries.

The existing Windsor-style/provider-neutral Marketing Data Core remains inside the Integration Hub responsibility. Marketing Automation consumes that evidence but does not own provider credentials or create a second connector framework.

## Foundations reused

- Stage 5 Marketing Data Core / Data Hub for provider-neutral ingestion, normalisation and lineage.
- Stage 6 Campaign, CampaignExecution, social publishing and deterministic attribution.
- Stage 7 Customer 360, lifecycle, deterministic segmentation, consent-aware journeys and campaign-to-revenue evidence.
- Communications for templates, delivery, retries and scheduled messages.
- Analytics & BI for deterministic metrics and reporting.
- Governed AI platform for advisory recommendations and copilots.

## Point 12 module rule

Every business-facing module must have one distinctive primary responsibility and must be independently allocatable through capability entitlements. Cross-module work uses dependencies and shared contracts rather than duplicated data stores or duplicated business rules.

The canonical catalogue and duplicate-responsibility validator live in:

`backend/src/platform/modules/businessModuleRegistry.js`

Tenant composition exposes resolved module allocation from enabled capability packs. Manual acceptance is recorded in:

`docs/roadmap/point12-business-module-boundaries.md`

## Marketing Automation authority

Marketing Automation owns:

- campaign definition and orchestration;
- journey definition and enrolment;
- audience activation from canonical CRM segments;
- campaign approval and scheduling;
- campaign attribution orchestration.

It consumes, but does not own:

- provider connections and credentials — Integration Hub;
- customer lifecycle, segments, consent/contactability — CRM & Customer Intelligence;
- message transport/templates/delivery state — Communications;
- deterministic metrics — Analytics & BI;
- recommendations/predictions — AI Decision Support;
- orders/payments/appointments — their canonical operational domains.

## Safety boundary

Marketing execution remains human-approved by default. Provider credentials, production sending, autonomous scheduling, model promotion, migrations and production activation remain controlled steps and are not enabled merely by allocating the module.
