# AI Intelligent Business Platform — Commercial Readiness Report

**Date:** 26 October 2026  
**Reference product:** SalonAI  
**Baseline:** Point 12 commercial source closure  
**Purpose:** establish an evidence-based platform status before owner-led manual acceptance, module tidy-up and the next roadmap cycle.

## Executive status

AIIBP has reached a **commercially structured source baseline suitable for systematic manual acceptance and tenant-configuration testing**. The platform is no longer best represented as a sequence of isolated SalonAI features: it now has shared Business/Location tenancy foundations, allocatable capability packs, canonical operational domains, governed integration/data layers and distinct AI decision-support capabilities.

This report does **not** assert that every optional provider is live or that every source-complete capability is production-accepted. Commercial readiness is tracked in four states:

1. **LIVE / production-accepted** — released and verified in production.
2. **SOURCE-COMPLETE / acceptance-gated** — implementation and automated gates are complete; manual/provider/production acceptance remains.
3. **OPTIONAL EXTERNAL ACTIVATION** — source support exists, but credentials/provider-console approval/test accounts or tenant commercial choice are required.
4. **NEXT ROADMAP** — genuine commercial/platform work that should follow acceptance rather than reopening completed domains.

## 1. Architecture baseline

The governing invariant is:

> **AIIBP owns the capability; each Business owns its configuration, data and experience.**

Permanent rules carried forward:

- one shared platform codebase; no tenant forks;
- Business -> Location -> users/resources/data boundaries;
- effective authority/RBAC and capability entitlement are separate concerns;
- canonical domain ownership is singular; duplicate sources of truth are prohibited;
- provider-specific adapters sit behind provider-neutral business/data contracts;
- external provider data retains provenance and maps into normalized AIIBP evidence;
- external write actions are permission/policy/audit controlled and human-approved by default;
- AI consumes canonical evidence and remains advisory unless a later explicitly governed action contract is approved;
- production changes use immutable release/deployment evidence and rollback controls.

## 2. Business module catalogue

The commercial module model should be the basis for the coming tidy-up/configuration pass.

| Business-facing module | Commercial responsibility | Current source status |
| --- | --- | --- |
| Appointments & Booking | booking, availability, appointment lifecycle and front desk | mature / production-proven core |
| Workforce & Staff | employees, staff ownership, eligibility and assignments | mature platform foundation |
| Service Catalogue | services/procedures and business/location configuration | mature platform foundation |
| Commerce | orders, checkout, payments, refunds/invoice/reconciliation contracts | advanced; verify current optional-provider acceptance during report cycle |
| Memberships | membership contracts/lifecycle/recovery | implemented foundation |
| Inventory & Purchasing | stock, suppliers, purchasing/replenishment | implemented foundation; intelligence expansion later |
| Loyalty / Stored Value | loyalty, gift/package/value ledgers | implemented foundations |
| Communications | SMS, WhatsApp, email, templates and delivery evidence | advanced; provider activation remains configuration-dependent |
| Calendar Integration | external staff/customer calendar sync/export | advanced; enabled providers require acceptance evidence |
| Integration Hub | provider connection/credential/sync authority | implemented shared authority |
| CRM & Customer Intelligence | Customer 360, lifecycle, segmentation and retention definitions | source-complete foundation |
| Analytics & BI | deterministic metrics, Data Hub views and evidence | source-complete foundation; advanced BI remains active |
| Marketing | campaigns, journeys, attribution, automation and Windsor/native data connectivity | Point 12 source-complete for acceptance |
| AI Business Adviser | management decision support | governed foundation; production model/tool promotion remains controlled |
| AI Receptionist | front-desk/customer conversational assistance | governed capability foundation |
| AI Retention Manager | retention recommendations/next-action support | governed source foundation |
| AI Stylist Copilot | professional appointment/consultation decision support | source-complete and merged |
| Clinical Records | specialist/clinical capability for appropriate verticals | vertical-specific; do not expose to unrelated tenants |

Internal engines such as `marketing-data`, `campaigns-attribution`, `marketing-automation` and the shared AI platform are **not separate commercial modules**. They are implementation dependencies of the customer-facing modules above.

## 3. Production-proven baseline

Repository evidence already demonstrates important production maturity:

- Stage 2 core salon operations is complete and live as release `v8.15.11`, including canonical booking/availability, walk-ins/reception, service packages, group bookings and trials.
- Stage 3 privacy/direct-marketing compliance controls were released and production-verified.
- Google Calendar two-way synchronization has production acceptance evidence in the Stage 3 authority record.
- release, deployment, P0 verification, rollback metadata, SBOM/security scanning and immutable-release practices are established platform capabilities rather than future design ideas.

Production evidence should continue to be recorded per enabled capability/provider; source completeness alone does not replace live acceptance.

## 4. Source-complete / acceptance-gated platform areas

### Identity and access

The platform contains substantial social-auth, RBAC, effective-authority, tenant and location work. Social-login source support includes Google, Facebook, Microsoft, Yahoo and LinkedIn. Individual providers remain optional external activations: they require real provider applications, credentials, exact redirects and controlled live tests.

### CRM / retention / marketing automation

Stage-7 source work provides Customer 360, lifecycle states, deterministic segmentation, consent-aware retention journeys, journey enrolment/outcomes, membership recovery and campaign-to-revenue evidence. Live autonomous provider execution remains intentionally gated.

### Data Hub / BI

The Data Hub extends the Marketing Data Core rather than creating a second ingestion authority. Source implementation includes normalized lineage, saved/cross-source analytical contracts, calculated evidence, connector health and governed AI-evidence consumption. Destination/write execution remains controlled.

### AI platform

The governed AI foundation includes gateway/model/tool/evidence concepts and multiple decision-support surfaces. AI promotion, model training/retraining, inference activation and consequential action execution remain governed production decisions rather than automatic consequences of source completion.

### Marketing / Windsor — Point 12

Point 12 now supplies:

- one Marketing module with native and Windsor connection modes;
- metadata-driven Windsor catalogue;
- provider-hosted OAuth/manual onboarding;
- Business-bound account reconciliation;
- Location-bound Data Hub ingestion;
- server-side secret handling;
- manual/hourly/daily/weekly synchronization configuration;
- shared scheduled-sync worker integration;
- persistent Windsor API rate budgeting with provider headroom;
- adaptive historical date-window backfill that reports unresolved one-day saturation instead of silently claiming completeness;
- curated Amazon Seller Central and eBay profiles;
- normalized seller KPI projection;
- customer UI for connection, preview, profile, import, cadence, backfill, KPI and disconnect;
- dedicated automated backend/frontend acceptance gate.

Point 12 is therefore **ready for manual/live-provider acceptance**, not automatically activated in production.

## 5. External/tenant activation matrix

The following are not engineering blockers when their source implementation is complete; they are tenant/provider acceptance decisions:

- Windsor team API key and commercial plan;
- individual Windsor-linked source accounts;
- Amazon Seller Central / eBay live accounts;
- Google/Facebook/Microsoft/Yahoo/LinkedIn social identity credentials;
- SendGrid/Twilio/WhatsApp production accounts and provider-specific acceptance where enabled;
- Google/Microsoft calendar credentials for tenants that require them;
- advertising/analytics/CRM providers selected by each tenant;
- provider terms, sender/domain verification, webhook registration and other provider-console requirements.

The platform should display disabled/unconfigured providers honestly instead of treating an unconfigured optional provider as a broken application.

## 6. Commercial safety and data boundaries

Before customer launch, acceptance must confirm:

- Business A cannot query/configure Business B connectors, sources, customers, staff, campaigns or AI evidence;
- Location-scoped data/actions fail closed outside the selected/effective Location where the domain requires location ownership;
- capability entitlement does not grant permissions by itself;
- secrets never appear in browser responses, logs, screenshots or support diagnostics;
- opt-outs/marketing suppression remain authoritative across automation;
- provider writes remain disabled unless their own action contract is explicitly implemented/approved;
- AI recommendations remain traceable to deterministic/canonical evidence;
- source-data retention and privacy settings are appropriate for each commercial connector.

## 7. Manual acceptance programme — immediate next gate

The owner-led acceptance pass should test the application as a set of allocatable modules, not only page-by-page.

### Module allocation

For at least two test Businesses:

- enable different module/capability combinations;
- verify disabled modules disappear or fail closed appropriately;
- verify internal engines are never sold/configured as duplicate modules;
- verify navigation contains one task-oriented route per commercial responsibility;
- identify any residual duplicate menu routes/pages and record them for tidy-up.

### Core workflows

Test representative desktop/tablet/mobile journeys for:

- registration/sign-in and staff/customer authority separation;
- services/staff/availability/booking/front desk;
- CRM/customer lifecycle/retention;
- communications and consent/preferences;
- campaign/marketing workflows;
- Data Hub/BI;
- AI assistants;
- commerce/inventory/membership/loyalty as allocated to the Business.

### Windsor / Sellers

Using non-production test accounts:

- configure Windsor server key;
- connect at least one ordinary marketing/analytics source;
- connect Amazon Seller Central and eBay if test accounts are available;
- verify Business/Location isolation;
- preview data;
- select seller profiles;
- import into Data Hub;
- change sync cadence;
- run bounded historical import;
- verify any saturated-day warning is preserved;
- compare seller KPIs against native provider reports;
- disconnect and confirm access is removed.

### HCI/accessibility

Record actual defects involving:

- viewport containment/popovers/modals;
- keyboard/focus order;
- labels/status/error recovery;
- responsive layouts;
- progressive disclosure and unnecessary complexity;
- business terminology.

Do not redesign working flows solely for visual change; amendments should be driven by observed task/usability defects.

## 8. Current risks / items not to misrepresent

- Not every optional connector has been live-tested with a real provider account.
- Windsor historical completeness cannot be claimed for a one-day high-cardinality window that still reaches the configured row cap; the UI/API reports this explicitly.
- Source-complete AI features are not equivalent to a promoted/trained production model.
- Destination/provider write operations remain disabled unless separately approved.
- Tenant-2 provisioning, commercial billing/self-service onboarding and broader white-label/i18n remain next-roadmap commercial-control-plane work unless repository evidence later shows they have already completed.
- A legacy Stage 1–6 aggregate regression workflow has historically contained unrelated failures; release decisions must inspect the actual failing job rather than override feature-specific green gates blindly.

## 9. Commercial go-live criteria

A Business can be considered commercially launch-ready only when the selected capability set has:

1. source implementation on current `main`;
2. relevant CI/security/specialist gates green or a narrowly documented unrelated legacy exception;
3. Business/Location/RBAC/isolation acceptance;
4. manual HCI/accessibility acceptance for the enabled user journeys;
5. required provider credentials/terms/webhooks/domains accepted;
6. live-provider smoke/acceptance for enabled providers;
7. production secret configuration and logging review;
8. privacy/retention/consent configuration;
9. immutable release + protected deployment + runtime/P0 verification;
10. rollback evidence and ownership for any residual risk.

## 10. Recommendation

Use the next cycle for **acceptance and rationalisation, not uncontrolled feature expansion**. The platform already contains broad functionality. The highest commercial value now comes from proving module isolation, removing residual duplicate navigation/surfaces, activating only the providers required by each tenant, closing observed usability defects, and building the remaining SaaS commercial control plane around the existing capability registry.

The new execution authority is `docs/MASTER_DEVELOPMENT_ROADMAP_v3.1.md`.
