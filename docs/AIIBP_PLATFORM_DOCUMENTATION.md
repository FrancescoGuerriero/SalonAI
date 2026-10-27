# AI Intelligent Business Platform (AIIBP)

**Commercial platform documentation**  
**Version:** 1.1  
**Date:** 27 October 2026  
**Platform model:** Modular multi-tenant SaaS  
**Reference implementation:** SalonAI

## 1. Platform definition

AIIBP is a modular SaaS platform for building custom business systems from one governed shared platform codebase.

A customer does not receive a code fork. Instead, AIIBP composes a tenant product from approved commercial modules, resolves their internal dependencies, applies tenant-specific configuration, branding, permissions, locations and integrations, and delivers one coherent SaaS application.

The governing hierarchy is:

`AIIBP Platform -> Product / Vertical Configuration -> Business -> Location -> Users / Resources`

The governing commercial rule is:

> Select the business capabilities required by the tenant; AIIBP resolves platform dependencies and delivers one custom-made SaaS product without duplicating business authority.

## 2. Product principles

AIIBP follows ten platform rules.

1. **One shared platform codebase.** Tenant differences are configuration, modules, themes, integrations and governed extensions.
2. **One canonical owner per business domain.** Booking, customers, payments, messages, campaigns, inventory and other operational truths have one owner.
3. **Commercial modules are independently selectable.** A tenant can select a module without manually buying or configuring its internal engine dependencies.
4. **Commercial modules are composable.** Supported modules can operate together through declared contracts.
5. **Tenant and location isolation is mandatory.** Data, credentials, dashboards, automation and AI context fail closed across boundaries.
6. **Entitlement and RBAC are separate controls.** The tenant must own a module before user permissions can expose it.
7. **External systems connect through AIIBP contracts.** Integrations extend the platform; they do not define its architecture.
8. **AI is governed assistance.** AI analyses, recommends and uses approved tools while canonical authority remains with the owning business module.
9. **Production activation is explicit.** Source completion does not automatically enable credentials, workers, migrations, backfills or consequential actions.
10. **Commercial readiness requires manual acceptance.** Automated tests are necessary but do not replace representative user and tenant-isolation testing.

## 3. Commercial module portfolio

AIIBP currently exposes **22 business-facing commercial modules**. Internal engines are not counted as commercial products.

### Core operations and commerce

| Module | Purpose | Independent selection |
| --- | --- | --- |
| Appointments & Booking | Availability, bookings, queues and appointment lifecycle | Yes |
| Workforce & Staff | Staff profiles, resources, rotas and assignment | Yes |
| Service Catalogue | Services, procedures and configuration | Yes |
| Commerce | Orders, checkout, payments and refunds | Yes |
| E-commerce & Online Store | Storefront, digital merchandising and online order orchestration | Yes; Service Catalogue and Commerce are auto-resolved |
| Memberships | Recurring membership contracts and lifecycle | Yes; Commerce is auto-resolved |
| Inventory & Purchasing | Stock, stock movement, purchasing and replenishment | Yes |
| Loyalty | Loyalty earning, balances and redemption | Yes; Commerce is auto-resolved |
| Seller & Marketplace Management | Marketplace channels, listings, seller orders, fulfilment and seller performance | Yes; Integration Hub and Commerce are auto-resolved |
| Clinical Records | Regulated clinical record state for supported clinical tenants | Yes where vertical-supported |

### Customer, growth and communication

| Module | Purpose | Independent selection |
| --- | --- | --- |
| Communications | Consent-aware inbound and outbound message delivery | Yes |
| Calendar Integration | Staff/customer calendar connection and synchronisation | Yes; Appointments is auto-resolved |
| Integration Hub | Provider connections, credentials and synchronisation contracts | Yes |
| CRM & Customer Intelligence | Customer 360, lifecycle, segmentation and retention definitions | Yes; Analytics is auto-resolved |
| Customer Experience | Feedback, reviews, referrals, service recovery and experience outcomes | Yes; CRM is auto-resolved |
| Marketing | Data connections, campaigns, audiences, attribution and governed automation | Yes; internal engines are auto-resolved |
| Analytics & Business Intelligence | Governed metrics, dashboards and analytical projections | Yes |
| Business Planning & Forecasting | Plans, targets, scenarios, forecasts and variance analysis | Yes; Analytics is auto-resolved |

### AI assistants

| Module | Purpose | Operating boundary |
| --- | --- | --- |
| AI Business Adviser | Evidence-grounded management decision support | Advisory / human-owned decisions |
| AI Receptionist | Front-desk and customer interaction assistance | Uses approved booking and communication tools |
| AI Retention Manager | Retention recommendations and next-action support | Marketing remains execution authority |
| AI Stylist Copilot | Salon professional decision support | Professional remains decision owner |

### Internal platform engines — not sold separately

The following capabilities support commercial modules but are not exposed as duplicate products:

- Shared AI foundation
- Marketing Data Engine
- Campaign & Attribution Engine
- Marketing Automation Engine
- Identity, authentication and tenancy infrastructure
- RBAC and effective-authority services
- Audit and provenance services
- Data Hub normalisation and lineage
- Metric Catalogue
- Integration Framework
- Workflow and notification infrastructure
- Observability, readiness and production-safety controls

## 4. What “independent module” means

Independent does **not** mean dependency-free.

A module is commercially independent when a tenant can select it as a business capability and AIIBP automatically resolves the internal dependencies required to make it work.

Installation therefore follows:

`selected commercial modules -> dependency closure -> vertical compatibility -> conflict checks -> entitlement -> configuration -> deployment`

Examples:

- Calendar Integration resolves Appointments automatically.
- Memberships resolves Commerce automatically.
- Loyalty resolves Commerce automatically.
- E-commerce & Online Store resolves Service Catalogue and Commerce automatically.
- Customer Experience resolves CRM automatically.
- Seller & Marketplace Management resolves Integration Hub and Commerce automatically.
- Business Planning & Forecasting resolves Analytics automatically.
- AI Receptionist resolves Shared AI, Communications and Appointments.
- AI Stylist Copilot resolves Shared AI, Appointments and Service Catalogue.
- Marketing resolves its internal data, campaign and automation engines plus Integration Hub, CRM, Communications and Analytics.

The tenant sees the commercial module, not the internal implementation graph.

## 5. Tenant product composition

A new tenant is delivered through a repeatable composition process.

### Step 1 — Business discovery

Capture:

- business model;
- locations;
- services/products;
- customer journeys;
- staff/resource model;
- sales and payment processes;
- data sources;
- communications channels;
- reporting requirements;
- automation opportunities;
- AI-assistance opportunities;
- privacy, retention and regulatory constraints.

### Step 2 — Module selection

Select only the commercial modules the business needs.

### Step 3 — Dependency resolution

AIIBP resolves required internal capabilities and validates that there are no ownership conflicts.

### Step 4 — Tenant configuration

Configure:

- business identity;
- locations;
- roles and permissions;
- terminology;
- branding and theme;
- domain/routing;
- module settings;
- provider connections;
- retention/privacy policies;
- AI policy and tool permissions.

### Step 5 — Acceptance

Run automated gates and role-based manual acceptance before production activation.

## 6. Integration Hub and Data Connections

AIIBP provides a provider-neutral integration architecture.

The platform owns:

- connection catalogue;
- business and location ownership;
- provider/account mapping;
- encrypted credential references;
- connection health;
- data ingestion;
- raw and normalised lineage;
- scheduling and retry policy;
- historical backfill controls;
- API request budgets;
- dashboards and analytical projections;
- AI interpretation of authorised tenant data.

Individual adapters are implementation details behind the AIIBP interface. Customer-facing documentation and navigation use AIIBP terminology rather than implementation-adapter branding.

## 7. Marketing module composition

Marketing is one business-facing module.

Internally it composes:

- marketing data ingestion and lineage;
- campaign execution evidence;
- attribution;
- CRM audiences;
- retention journeys;
- communication delivery;
- scheduling and approval workflows;
- analytics;
- AI-assisted interpretation and recommendations.

This avoids exposing multiple overlapping marketing products to the tenant.

## 8. Analytics and decision intelligence

Analytics owns deterministic business metrics and read models.

Typical outputs include:

- revenue;
- bookings;
- utilisation;
- conversion;
- retention;
- campaign performance;
- seller performance;
- stock and replenishment indicators;
- workforce performance;
- customer lifecycle metrics.

AI assistants consume governed analytical evidence. AI-generated interpretation is clearly separated from deterministic metrics.

## 9. AI operating model

AIIBP uses a shared governed AI foundation with separate business-facing assistants.

AI may:

- summarise tenant-owned information;
- identify anomalies and opportunities;
- forecast or rank options where an approved model contract exists;
- recommend business actions;
- explain recommendations;
- use approved read tools;
- use approved write tools only where RBAC, consent and action policy permit it.

AI may not:

- cross tenant or location boundaries;
- reveal credentials or secrets;
- replace canonical business data;
- bypass the module that owns an operation;
- execute consequential external actions without an approved action contract;
- present generated output as deterministic evidence.

## 10. Security and SaaS isolation

AIIBP separates:

- tenant entitlement;
- user RBAC;
- location authority;
- provider credentials;
- operational data;
- analytics;
- automation state;
- AI context and provenance.

Every business operation is evaluated against trusted Business and, where required, Location context.

## 11. Supported tenant patterns

AIIBP is designed to support vertical and custom configurations from the same platform.

Current reference patterns include:

- salon / hair and beauty;
- spa / wellness;
- fitness;
- specialist clinical services;
- configurable custom service-business tenants.

The platform can add further vertical packs without creating a second platform architecture.

## 12. Commercial delivery lifecycle

A typical AIIBP engagement follows:

1. Discover the business.
2. Select modules.
3. Resolve dependencies.
4. Configure the tenant.
5. Connect approved external systems.
6. Import or migrate approved data.
7. Configure dashboards and AI assistance.
8. Run automated platform gates.
9. Run role-based manual acceptance.
10. Issue a readiness report.
11. Release through a controlled deployment process.
12. Monitor, measure and evolve the tenant configuration.

## 13. Module acceptance requirements

Every commercial module should have:

- a distinct business purpose;
- one canonical domain boundary;
- entitlement gating;
- RBAC gating;
- a module landing page or clearly owned application workspace;
- empty, loading, not-configured and error states;
- auditability for state-changing operations;
- declared dependencies;
- declared supported verticals;
- manual acceptance tests;
- compatibility with other modules in the same tenant.

## 14. Platform readiness terminology

AIIBP distinguishes four states:

- **Implemented** — source capability exists.
- **Validated** — relevant automated gates pass.
- **Accepted** — representative manual testing has passed.
- **Production enabled** — credentials, workers, migrations, integrations and release controls have been explicitly activated.

A capability is not described as production-ready merely because source code exists.

## 15. Forward roadmap

The forward authority is `docs/MASTER_DEVELOPMENT_ROADMAP_v3.2.md`.

Immediate productisation priorities are:

1. module-by-module acceptance and navigation tidy-up;
2. automated installability/composition report for every supported vertical;
3. manual testing and amendment log;
4. tenant provisioning control plane;
5. provider/Data Hub production acceptance;
6. BI and AI acceptance;
7. repeatable delivery of the next custom tenant.
