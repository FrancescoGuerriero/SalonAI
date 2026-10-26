# AIIBP business module boundaries

Date: 26 October 2026  
Authority: Point 12 — Marketing Automation / AIIBP platform composition

## Purpose

AIIBP modules must be commercially allocatable to a Business without creating duplicate sources of truth or overlapping product responsibilities.

The platform distinguishes:

1. **Operational modules** — own canonical business state.
2. **Integration/data modules** — connect external platforms and normalise provider evidence; they do not replace canonical business state.
3. **Automation modules** — orchestrate approved actions by consuming operational/data modules; they do not recreate those domains.
4. **AI assistant modules** — analyse evidence and assist human decisions; they do not silently become operational authority.
5. **Business-facing bundles** — package related internal engines as one commercial module where exposing every internal component would create duplication or confusing tenant configuration.

The capability registry is the machine-readable authority. Every active canonical domain must have at most one owning capability.

## Business-facing module catalogue

| Module | Class | Distinct responsibility | Connects platforms | AI decision support | Canonical authority |
| --- | --- | --- | --- | --- | --- |
| Appointments & Booking | Operations | Availability, booking and appointment lifecycle | Calendar/communications consumed through dependencies | No | Booking/availability |
| Workforce & Staff | Operations | Staff profiles and resource assignment | Optional downstream integrations | No | Workforce |
| Service Catalogue | Operations | Services/procedures and service configuration | No | No | Service catalogue |
| Commerce | Operations | Orders, checkout, payments and refunds | Payment providers through adapters | Optional downstream | Commercial transactions |
| Communications | Integration | Consent-aware SMS/email/WhatsApp/message delivery | Yes | No | Message delivery only |
| Calendar Integration | Integration | Staff/customer calendar connections and sync | Yes | No | Calendar connection/sync only; Appointments remains booking authority |
| Integration Hub | Integration | Reusable provider connection, credential and sync contracts | Yes | No | Provider connection/credential state |
| Analytics & BI | Analytics | Metrics, dashboards and analytical projections | Consumes connected/operational data | Supports AI evidence | Metrics/read models only |
| CRM & Customer Intelligence | Operations/read-model | Customer 360, lifecycle, segmentation and retention journey definitions/outcomes | Consumes communication/marketing evidence | Feeds AI assistants | CRM intelligence/retention definitions |
| Marketing | Bundle | Single business-facing marketing module combining Windsor-style marketing data, campaigns, attribution, CRM audiences and governed automation | Yes, through Integration Hub | Can consume AI recommendations | Marketing module experience; internal engines keep their own canonical ownership |
| AI Business Adviser | AI Assistant | Evidence-grounded management decision support | Through governed tools only | Yes | Advice only; no canonical business writes |
| AI Receptionist | AI Assistant | Governed front-desk/customer assistance using booking and communication tools | Through approved communication/booking tools | Yes | Assistance only; operational modules remain authoritative |
| AI Retention Manager | AI Assistant | Retention recommendations, audiences, channel/next-action advice | No direct autonomous send authority | Yes | Retention advice only |
| AI Stylist Copilot | AI Assistant | Salon professional appointment/consultation/history/service/product/aftercare support | No direct provider authority | Yes | Decision support only; professional remains decision owner |
| Memberships | Operations | Membership contracts and lifecycle | Commerce consumed for payments | Optional downstream | Membership lifecycle |
| Inventory & Purchasing | Operations | Stock, movement, purchasing and replenishment | Supplier integrations may be adapters | Optional downstream | Inventory/purchasing |
| Loyalty | Operations | Loyalty earning, redemption and balances | Commerce consumed for transactions | Optional downstream | Loyalty ledger |
| Clinical Records | Specialist | Regulated clinical record state for supported clinical verticals | Provider connections only where explicitly governed | AI optional and separately governed | Clinical records |

## Marketing module composition

The business is allocated **one Marketing module**. The following are internal platform components and are deliberately not directly allocatable:

### Marketing Data Engine

Purpose: first-party/Windsor-style provider-neutral ingestion, normalisation and lineage.

Owns:
- marketing source ingestion;
- normalised marketing facts;
- data lineage/provenance.

Does not own:
- campaign definitions;
- campaign execution;
- CRM lifecycle/segmentation;
- message delivery;
- automation schedules/runs.

### Campaign & Attribution Engine

Purpose: canonical campaign definitions/executions, social publication, performance and deterministic attribution.

Owns:
- campaign;
- campaign execution;
- social publication;
- marketing attribution.

Does not own:
- source connector credentials;
- Customer 360/lifecycle;
- marketing automation runs;
- AI recommendations.

### Marketing Automation Engine

Purpose: trigger, approval, schedule and multi-channel orchestration using existing CRM, campaign, communications and marketing-data authorities.

Owns:
- marketing triggers;
- automation policy;
- automation-run evidence.

Consumes rather than recreates:
- customer segments/lifecycle;
- retention journey definitions;
- campaign definitions/executions;
- message delivery;
- marketing normalised data.

Live provider execution remains subject to permissions, consent, provider readiness, human approval policy, audit and production activation gates.

## AI boundary

The shared `ai` capability is infrastructure and is **not directly allocated as a business product**.

Business-facing AI assistants depend on it. An AI assistant may:
- summarise evidence;
- identify patterns;
- rank or recommend options;
- explain likely implications;
- propose actions;
- invoke explicitly authorised tools within its permission/policy boundary.

An AI assistant must not silently take ownership of canonical operational domains. Decision-support modules marked `decisionSupportOnly` remain advisory and human-reviewed.

Examples:
- AI Retention Manager may recommend an audience and channel, but Marketing owns approved execution.
- AI Business Adviser may recommend a pricing or staffing decision, but Commerce/Staff/Services remain operational authorities.
- AI Stylist Copilot may recommend consultation/service/aftercare context, but the professional remains the decision owner.

## Allocation rule

Tenant/business configuration should display `allocatableCapabilityPackKeys`, not every internal capability.

Internal engines can be installed automatically as dependencies of an allocated module. This prevents a Business from being sold or configured with multiple modules that appear to perform the same job.

## Non-duplication rule

For every active capability:

- `ownedDomains` identifies canonical ownership.
- `consumesDomains` documents read/use relationships.
- two active modules may not own the same canonical domain;
- AI assistants must depend on the shared AI platform;
- decision-support-only capabilities must be AI assistant modules;
- internal engines can be non-allocatable while remaining supported platform capabilities.

`validateProductRegistryIntegrity()` enforces these rules, and `point12BusinessModuleBoundaries.test.js` provides regression coverage.

## Point 12 direction

Point 12 should therefore extend the existing **Marketing** module instead of creating another standalone marketing product. The module will compose existing Marketing Hub/Data Hub, campaigns/attribution, CRM/retention, communications and governed automation. New work should concentrate on orchestration, approvals, schedules, execution evidence and management UX, not duplicate connectors, CRM data, campaigns, attribution or communication delivery.
