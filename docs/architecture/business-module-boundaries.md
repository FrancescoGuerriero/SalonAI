# AIIBP business module boundaries

Date: 26 October 2026  
Authority: Point 12 — modular SaaS composition

## Purpose

AIIBP is a modular SaaS platform for configuring custom business systems from independently selectable modules. A tenant selects the business-facing capabilities it needs; AIIBP resolves internal/runtime dependencies automatically and deploys one governed product composition from the shared platform codebase.

The platform distinguishes:

1. **Operational modules** — own canonical business state.
2. **Integration/data modules** — connect external platforms and normalise external evidence without replacing canonical business state.
3. **Automation modules** — orchestrate approved actions using existing authorities rather than recreating them.
4. **AI assistant modules** — analyse evidence, use governed tools and assist decisions without silently becoming operational authority.
5. **Business-facing bundles** — package related internal engines as one commercial module where exposing every engine would create duplication or configuration noise.

The capability registry is the machine-readable authority. Every active canonical domain has at most one owner.

## Commercial module catalogue

| Module | Class | Distinct responsibility | Standalone commercial selection |
| --- | --- | --- | --- |
| Appointments & Booking | Operations | Availability, booking and appointment lifecycle | Yes |
| Workforce & Staff | Operations | Staff profiles and resource assignment | Yes |
| Service Catalogue | Operations | Services/procedures and configuration | Yes |
| Commerce | Operations | Orders, checkout, payments and refunds | Yes |
| Communications | Integration | Consent-aware communication delivery | Yes |
| Calendar Integration | Integration | Calendar connection/sync while Appointments remains booking authority | Yes; Appointments auto-resolved |
| Integration Hub | Integration | Provider connections, credentials and sync contracts | Yes |
| Analytics & BI | Analytics | Metrics, dashboards and analytical projections | Yes |
| CRM & Customer Intelligence | Operations/read model | Customer 360, lifecycle, segmentation and retention definitions | Yes; Analytics auto-resolved |
| Marketing | Bundle | AIIBP data connections, campaigns, attribution, CRM audiences and governed automation | Yes; internal marketing engines auto-resolved |
| AI Business Adviser | AI assistant | Evidence-grounded management decision support | Yes; AI/Analytics auto-resolved |
| AI Receptionist | AI assistant | Governed front-desk/customer assistance | Yes; AI/Communications/Appointments auto-resolved |
| AI Retention Manager | AI assistant | Retention recommendations and next-action support | Yes; AI/CRM/Analytics auto-resolved |
| AI Stylist Copilot | AI assistant | Salon professional decision support | Yes; AI/Appointments/Services auto-resolved |
| Memberships | Operations | Membership contracts and lifecycle | Yes; Commerce auto-resolved |
| Inventory & Purchasing | Operations | Stock, movement, purchasing and replenishment | Yes |
| Loyalty | Operations | Loyalty earning, redemption and balances | Yes; Commerce auto-resolved |
| Clinical Records | Specialist | Regulated clinical records for supported clinical tenants | Yes where vertical-supported |

## Independent does not mean dependency-free

A commercial module is independent when the tenant can select and use it as a product capability without manually purchasing or configuring its internal dependencies.

AIIBP therefore uses dependency closure:

`selected commercial modules -> required operational/platform dependencies -> one installation plan`

Examples:
- Calendar includes Appointments internally.
- Memberships and Loyalty include Commerce internally.
- AI assistants include the shared AI foundation and the operational authorities they are permitted to use.
- Marketing includes the internal Marketing Data, Campaign/Attribution and Automation engines plus CRM, Communications, Analytics and Integration Hub dependencies.

Internal dependencies are platform implementation details, not duplicate commercial products.

## Marketing composition

The tenant receives one **Marketing** module. Its internal engines are deliberately non-allocatable:

- **Marketing Data Engine** — provider-neutral ingestion, normalisation and lineage.
- **Campaign & Attribution Engine** — canonical campaign/execution/social-publication/attribution authority.
- **Marketing Automation Engine** — triggers, approvals, schedules and orchestration.

The business-facing module consumes those authorities alongside CRM, Communications, Analytics and Integration Hub. It does not recreate their canonical state.

## Data connection boundary

AIIBP owns:
- the business-facing connection catalogue;
- tenant/account mapping;
- credential references and authorization-session mapping;
- Data Hub ingestion and lineage;
- scheduling, retry, backfill and rate budgets;
- seller KPI projections;
- monitoring and customer UX.

Direct provider adapters and optional managed connection adapters sit behind the same provider-neutral AIIBP contract. External provider names are integration targets, not platform architecture authorities.

## AI boundary

The shared `ai` capability is internal infrastructure and is not sold directly. Business-facing AI assistants may summarise evidence, identify patterns, rank options, recommend actions and invoke explicitly authorised tools within policy. Canonical operational writes remain with the owning operational modules unless an explicit governed action contract grants that operation.

## Non-duplication and installability rules

- `ownedDomains` identifies canonical ownership.
- `consumesDomains` documents read/use relationships.
- no two active modules may own the same canonical domain.
- internal capabilities cannot be selected directly as commercial modules.
- commercial modules automatically resolve their dependencies.
- every allocatable module must be independently installable in each vertical it supports.
- all supported allocatable modules for a vertical must also compose into one valid tenant installation plan.

`validateProductRegistryIntegrity()`, `moduleInstallationResolver.js`, `point12BusinessModuleBoundaries.test.js` and `point12ModuleInstallability.test.js` enforce these rules.
