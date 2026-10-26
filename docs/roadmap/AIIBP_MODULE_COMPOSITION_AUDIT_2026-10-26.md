# AIIBP Module Composition Audit

**Date:** 26 October 2026  
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

`point12ModuleInstallability.test.js` and `point12BusinessModuleBoundaries.test.js` pass the following checks:

- every allocatable module is independently installable in every vertical it supports;
- dependency closure works for commercial selections;
- all commercial modules supported by a vertical compose into one installation plan;
- internal capabilities cannot be selected directly;
- no two active capabilities own the same canonical business domain;
- AI assistant modules use the shared AI foundation rather than creating independent AI authorities.

## Supported commercial module counts

| Vertical | Commercial modules supported | Audit result |
| --- | ---: | --- |
| Salon | 17 | PASS |
| Spa | 16 | PASS |
| Fitness | 15 | PASS |
| Plastic Surgery | 13 | PASS |

These counts include experimental `Clinical Records` where supported by the Plastic Surgery vertical. Internal platform engines are excluded from the commercial count.

## Shared commercial modules

The following business-facing modules are supported across all four current service verticals:

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

## Vertical-specific commercial modules

### Salon

Adds:
- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- AI Retention Manager
- AI Stylist Copilot

### Spa

Adds:
- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- AI Retention Manager

### Fitness

Adds:
- Commerce
- Memberships
- Loyalty
- AI Retention Manager

### Plastic Surgery

Adds:
- Inventory & Purchasing
- Clinical Records (experimental)

## Dependency-closure examples

| Selected commercial module | Automatically resolved dependencies |
| --- | --- |
| Calendar Integration | Appointments & Booking |
| CRM & Customer Intelligence | Analytics & BI |
| Memberships | Commerce |
| Loyalty | Commerce |
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

The business-facing Marketing and AI assistant modules consume these authorities rather than recreating them.

## Data-connection outcome

The connection architecture is now AIIBP-owned and provider-neutral:

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

**Automated modular architecture audit: PASS.**

The current capability model supports independently selectable commercial modules and dependency-resolved composition for custom tenant products across the four registered verticals. The next decision gate is owner-led manual acceptance, followed by configuration of the next tenant using the module-selection and dependency-resolution model defined in `MASTER_DEVELOPMENT_ROADMAP_v3.2.md`.
