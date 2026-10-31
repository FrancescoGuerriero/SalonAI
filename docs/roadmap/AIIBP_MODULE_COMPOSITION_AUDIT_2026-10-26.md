# AIIBP Module Composition Audit

**Originally recorded:** 26 October 2026  
**Refreshed:** 29 October 2026  
**Scope:** Point 12 modular SaaS architecture  
**Branch:** `dev1-point12-marketing-automation`  
**Purpose:** prove that business-facing modules can be selected independently and composed into custom tenant products without duplicate canonical ownership.

## Audit definition

A commercial module passes the independence test when:

1. it is marked allocatable;
2. it supports the selected vertical;
3. its dependency graph is valid and cycle-free;
4. every required dependency supports the same vertical;
5. internal dependencies are resolved automatically rather than sold/configured as duplicate commercial products;
6. no required capability conflicts with another required capability;
7. canonical business-domain ownership remains unique.

A vertical passes the composition test when all of its supported commercial modules can be selected together and produce one dependency-closed installation plan with no duplicate capability keys or ownership conflicts.

## Automated result

`point12ModuleInstallability.test.js` and `point12BusinessModuleBoundaries.test.js` now enforce the current Point 12 commercial contract:

- exactly **22 allocatable commercial modules** exist in the current global catalogue;
- every allocatable module is independently installable in every vertical it supports;
- expected per-vertical commercial-module counts are explicit and regression-gated;
- dependency closure works for commercial selections;
- all commercial modules supported by a vertical compose into one installation plan;
- internal capabilities cannot be selected directly;
- no two active capabilities own the same canonical business domain;
- AI assistant modules use the shared AI foundation rather than creating independent AI authorities.

The refreshed audit was performed after the AI Receptionist management-workspace slice. The Point 12 Modular SaaS Gate, Stage 1–6 regression gate, Fast CI, AI Training Validation and the related Point 8/10 gates were green for the preceding validated source baseline; subsequent audit-only changes remain subject to the same CI gates.

## Current commercial portfolio size

The global AIIBP registry contains **22 unique allocatable commercial modules**. Internal engines such as Shared AI, Marketing Data, Campaign & Attribution and Marketing Automation are excluded from this count because they are dependency-resolved platform capabilities rather than products sold independently.

## Supported commercial module counts

| Vertical | Commercial modules supported | Audit result |
| --- | ---: | --- |
| Salon | 21 | PASS |
| Spa | 20 | PASS |
| Fitness | 19 | PASS |
| Plastic Surgery | 15 | PASS |

`Clinical Records` remains experimental and is allocatable only for the Plastic Surgery vertical. A vertical does not need to expose all 22 global commercial modules; it exposes only the modules whose contracts explicitly support that vertical.

## Shared commercial modules

The following **13 business-facing modules** are supported across all four current service verticals:

1. Appointments & Booking
2. Workforce & Staff
3. Service Catalogue
4. Communications
5. Calendar Integration
6. Analytics & Business Intelligence
7. Integration Hub
8. CRM & Customer Intelligence
9. Marketing
10. AI Business Adviser
11. AI Receptionist
12. Business Planning & Forecasting
13. Customer Experience

## Additional vertical-supported modules

### Salon — 8 additional modules

- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- AI Retention Manager
- AI Stylist Copilot
- E-commerce & Online Store
- Seller & Marketplace Management

Total: **21**.

### Spa — 7 additional modules

- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- AI Retention Manager
- E-commerce & Online Store
- Seller & Marketplace Management

Total: **20**.

### Fitness — 6 additional modules

- Commerce
- Memberships
- Loyalty
- AI Retention Manager
- E-commerce & Online Store
- Seller & Marketplace Management

Total: **19**.

### Plastic Surgery — 2 additional modules

- Inventory & Purchasing
- Clinical Records (experimental)

Total: **15**.

## New Point 12 commercial bundles

The expanded portfolio includes four business-facing modules that consume existing canonical authorities rather than duplicating them:

| Commercial module | Supported verticals | Dependency closure |
| --- | --- | --- |
| E-commerce & Online Store | Salon, Spa, Fitness | Commerce |
| Business Planning & Forecasting | Salon, Spa, Fitness, Plastic Surgery | Analytics & BI + AI Business Adviser/shared AI dependency chain |
| Customer Experience | Salon, Spa, Fitness, Plastic Surgery | CRM + Communications + Analytics & BI |
| Seller & Marketplace Management | Salon, Spa, Fitness | Integration Hub + Commerce + Analytics & BI |

These modules own their business-facing workspace or bundle-specific domains while the underlying operational truth remains with the established canonical modules.

## Dependency-closure examples

| Selected commercial module | Automatically resolved dependencies |
| --- | --- |
| Calendar Integration | Appointments & Booking |
| CRM & Customer Intelligence | Analytics & BI |
| Memberships | Commerce |
| Loyalty | Commerce |
| E-commerce & Online Store | Commerce |
| Business Planning & Forecasting | Analytics & BI + AI Business Adviser + Shared AI foundation |
| Customer Experience | CRM + Communications + Analytics & BI |
| Seller & Marketplace Management | Integration Hub + Commerce + Analytics & BI |
| AI Business Adviser | Shared AI foundation + Analytics & BI |
| AI Receptionist | Shared AI foundation + Communications + Appointments |
| AI Retention Manager | Shared AI foundation + CRM + Analytics & BI |
| AI Stylist Copilot | Shared AI foundation + Appointments + Service Catalogue |
| Marketing | Integration Hub + Marketing Data Engine + Campaign & Attribution Engine + Marketing Automation Engine + CRM + Communications + Analytics & BI |

The tenant selects the commercial module; AIIBP supplies these dependencies as implementation/runtime requirements.

## Internal capabilities that must not be sold separately

- Shared AI platform
- Marketing Data Engine
- Campaign & Attribution Engine
- Marketing Automation Engine

They exist to support commercial modules and preserve singular authority boundaries.

## Canonical ownership outcome

The capability registry enforces one owner for each canonical business domain. Examples include:

- booking/availability → Appointments
- workforce → Staff
- service catalogue → Services
- orders/payments → Commerce
- message delivery → Communications
- provider credentials/connections → Integration Hub
- metrics/BI → Analytics
- customer lifecycle/segmentation → CRM
- campaign execution/attribution → Campaign & Attribution Engine
- marketing automation runs → Marketing Automation Engine
- AI inference/provenance/tool governance → Shared AI platform

The business-facing Marketing, commercial bundles and AI assistant modules consume these authorities rather than recreating them.

## AI Receptionist acceptance boundary

AI Receptionist is a commercial AI assistant that depends on Shared AI, Communications and Appointments. Its current A1 contract remains proposal-oriented:

- it may read approved service/availability evidence;
- it may create reviewable appointment proposals;
- it does not directly create, reschedule or cancel canonical appointments;
- management visibility is tenant-scoped and permission-gated;
- operator booking work remains linked to the established WhatsApp/front-desk and deterministic appointment services.

This prevents AI Receptionist from becoming a parallel booking authority.

## Data-connection outcome

The connection architecture is AIIBP-owned and provider-neutral:

- AIIBP owns the commercial connection catalogue and customer UX;
- native and optional managed adapters sit behind common platform contracts;
- Business/Location ownership is enforced;
- Data Hub remains canonical for imported evidence;
- scheduling, backfill and rate budgets are shared platform functions;
- seller KPI summaries consume normalised Data Hub evidence;
- provider write actions are separately governed.

## Manual acceptance still required

Automated composition passing does not replace product acceptance. Before the next tenant is considered commercially ready, manually test:

1. each allocated module alone;
2. representative multi-module combinations;
3. all-module composition for the chosen vertical;
4. disabled entitlement behaviour;
5. role/RBAC behaviour;
6. Business and Location isolation;
7. navigation clarity and absence of duplicate management surfaces;
8. provider configuration/error/recovery states;
9. AI assistant boundaries;
10. mobile/accessibility/browser behaviour.

## Conclusion

**Automated modular architecture audit: PASS for the current 22-module commercial portfolio.**

The current capability model supports independently selectable commercial modules and dependency-resolved composition across all four registered verticals. The automated contract now fails if the declared 22-module portfolio or the audited per-vertical counts drift without an intentional update.

The next roadmap gate is owner-led/manual module acceptance and amendment capture, followed by the updated platform readiness report and tenant-provisioning control plane work. Production credentials, provider activation, migrations, backfills, workers and model promotion remain separately controlled.
