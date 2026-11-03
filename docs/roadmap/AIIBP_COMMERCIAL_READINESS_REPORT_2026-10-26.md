# AI Intelligent Business Platform — Commercial Readiness Report

**Date:** 26 October 2026  
**Reference product:** SalonAI  
**Baseline:** Point 12 modular SaaS architecture  
**Purpose:** establish platform status before owner-led manual acceptance and the next tenant configuration.

## Executive status

AIIBP has reached a **commercially structured modular SaaS source baseline suitable for systematic manual acceptance and tenant-composition testing**.

The platform is defined by:

- one shared codebase;
- Business → Location tenancy boundaries;
- commercial capability packs;
- singular canonical domain ownership;
- automatic dependency resolution;
- entitlement separate from RBAC;
- provider-neutral Integration Hub/Data Hub contracts;
- governed automation;
- distinct AI assistant modules;
- production activation gates.

This report does not claim that every provider is live or every source-complete feature is production-accepted. Production credentials, live account connections, worker activation, migrations, historical imports and provider write actions remain separately controlled.

## Module architecture audit

Commercial modules are considered independent when a tenant can select them individually and AIIBP automatically supplies any required internal/runtime dependencies.

Examples:

- Calendar Integration resolves Appointments.
- Memberships and Loyalty resolve Commerce.
- AI Business Adviser resolves shared AI and Analytics.
- AI Receptionist resolves shared AI, Communications and Appointments.
- AI Retention Manager resolves shared AI, CRM and Analytics.
- AI Stylist Copilot resolves shared AI, Appointments and Services.
- Marketing resolves its internal data/campaign/automation engines plus Integration Hub, CRM, Communications and Analytics.

Internal engines are not presented as duplicate commercial products.

Automated contracts now verify:

1. no duplicate canonical domain ownership;
2. internal capabilities cannot be selected directly;
3. every allocatable module can be selected independently for each vertical it supports;
4. dependencies are automatically closed;
5. all supported commercial modules for a vertical can compose into one installation plan without duplicate capability keys.

## Commercial module portfolio

### Core operations
- Appointments & Booking
- Workforce & Staff
- Service Catalogue
- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- Clinical Records where supported

### Customer, growth and integration
- Communications
- Calendar Integration
- Integration Hub
- Analytics & Business Intelligence
- CRM & Customer Intelligence
- Marketing

### AI assistants
- AI Business Adviser
- AI Receptionist
- AI Retention Manager
- AI Stylist Copilot

### Internal platform capabilities
- Shared AI foundation
- Marketing Data Engine
- Campaign & Attribution Engine
- Marketing Automation Engine
- common tenancy/RBAC/audit/observability infrastructure

## Marketing / Data Connections readiness

The Marketing module now presents AIIBP-managed Data Connections rather than an adapter-branded product.

AIIBP owns:

- connection catalogue;
- Business/account mapping;
- credential references;
- Data Hub ingestion and lineage;
- manual/hourly/daily/weekly sync configuration;
- shared scheduling/retry controls;
- adaptive bounded historical backfill;
- persistent request budgets;
- Amazon/eBay seller data profiles;
- seller KPI projections from normalised evidence;
- management UX;
- governed AI interpretation.

Direct provider adapters and optional managed connection adapters sit behind the same provider-neutral AIIBP contract. External provider names identify integration targets only.

## Tenancy and security baseline

Current architectural controls require:

- trusted Business context;
- Location context for location-owned Data Hub operations;
- tenant-owned account checks;
- tenant/location-owned Data Hub source checks;
- encrypted provider credential storage;
- permission gates on management actions;
- no provider password collection;
- no autonomous provider write actions from the data-connection layer.

Manual Business A/Business B and Location A/Location B live acceptance remains required before production activation.

## AI readiness baseline

AI is separated into an internal foundation and business-facing assistants.

AI may analyse evidence, detect patterns, recommend actions and invoke explicitly governed tools. It must not cross tenant boundaries, reveal secrets, overwrite canonical authority silently or execute consequential external actions without a permitted action/approval contract.

## Items requiring owner-led manual acceptance

1. Module landing/navigation clarity.
2. Single-module tenant compositions.
3. Multi-module tenant compositions.
4. Disabled-module behaviour.
5. RBAC by role.
6. Business/Location isolation.
7. Representative native data connections.
8. Representative managed data connections.
9. Amazon/eBay seller workflows where required.
10. Data preview/import/scheduled sync/history import.
11. KPI reconciliation against provider reports.
12. Automation approval/consent behaviour.
13. AI assistant boundaries and explanations.
14. Accessibility/responsive/browser behaviour.
15. Error/recovery/unconfigured states.

## Production-gated items

The following must remain explicit controlled operations:

- production secret configuration;
- provider account activation;
- enabling background sync workers;
- production migrations/backfills;
- write-capable provider operations;
- autonomous external actions;
- AI training/model promotion/production inference activation where gated;
- immutable release/deployment and rollback evidence.

## Commercial readiness conclusion

AIIBP is ready for the next phase: **manual module acceptance, navigation/module tidy-up and configuration of the next custom tenant from the shared modular platform**.

Roadmap authority for that work is `MASTER_DEVELOPMENT_ROADMAP_v3.2.md`.
