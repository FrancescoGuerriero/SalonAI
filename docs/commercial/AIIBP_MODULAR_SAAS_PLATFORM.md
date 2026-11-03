# AI Intelligent Business Platform (AIIBP)

## Modular SaaS Platform — Commercial Product Documentation

**Status:** Commercial platform definition for tenant configuration and delivery  
**Architecture:** One governed AIIBP codebase, composed into tenant-specific SaaS installations  
**Reference implementation:** SalonAI is one tenant/vertical implementation, not the platform itself.

## 1. Product proposition

AIIBP is a modular SaaS platform for building tailored business-management systems without creating a separate software fork for every customer. A tenant receives a governed composition of commercial modules, configuration, integrations, permissions, locations, workflows and AI capabilities relevant to its business model.

The delivery model is:

**AIIBP Platform Core → Commercial Modules → Vertical Eligibility → Tenant Configuration → Location Configuration → Roles & Permissions → Integrations → AI Policies → Custom SaaS Experience**

Modules can be allocated individually where their dependencies permit or combined to create a broader operating platform. Canonical business domains have one owning module; other modules consume that authority through defined contracts rather than duplicating it.

## 2. Commercial module catalogue

1. **Appointments & Booking** — availability, appointment lifecycle, online booking, queues and booking operations.
2. **Workforce & Staff** — employees, staff profiles, roles, assignments, rota and workforce operations.
3. **Service Catalogue** — services, pricing, duration, configuration and location-specific offerings.
4. **Commerce** — orders, checkout, payments, refunds and transactional business state.
5. **Memberships** — membership contracts, benefits, lifecycle and recurring commercial relationships.
6. **Inventory & Purchasing** — stock, stock movement, suppliers, purchasing and replenishment.
7. **Loyalty** — points, rewards, balances, redemption and incentive programmes.
8. **Communications** — governed customer and staff communications across configured channels.
9. **Calendar Integration** — external calendar connections and appointment/calendar synchronisation.
10. **Integration Hub** — external system connections, credentials, synchronisation and integration health.
11. **CRM & Customer Intelligence** — Customer 360, lifecycle, segmentation, retention and relationship intelligence.
12. **Analytics & Business Intelligence** — dashboards, governed metrics, reporting and analytical projections.
13. **Marketing** — audiences, campaigns, journeys, attribution, automation and marketing performance.
14. **AI Business Adviser** — governed management insight, recommendations and decision support.
15. **AI Receptionist** — front-desk, enquiry, booking and customer-service assistance.
16. **AI Retention Manager** — churn/retention analysis and recommended retention actions.
17. **AI Stylist Copilot** — professional consultation and service decision support for appropriate verticals.
18. **Clinical Records** — controlled treatment/clinical records for eligible regulated verticals.
19. **E-commerce & Online Store** — digital storefront, online catalogue, cart, merchandising and online sales experience.
20. **Business Planning & Forecasting** — revenue, demand, capacity, staffing, inventory and scenario forecasting.
21. **Customer Experience** — end-to-end journey quality, feedback, service recovery, experience measurement and customer-facing experience controls.
22. **Seller & Marketplace Management** — marketplace/seller account intelligence, product/listing evidence, orders, fees, performance and marketplace analytics.

## 3. Internal engines

Internal engines are platform infrastructure. They are not normally sold as standalone customer modules and should not appear as duplicate commercial products.

- Identity & Authentication
- Business/Tenant Context
- Location Context
- RBAC & Effective Authority
- Capability Registry
- Vertical Pack Registry
- Tenant Product Manifest
- Entitlements & Feature Control
- Configuration Inheritance
- Audit & Provenance
- Privacy & Consent Governance
- AI Gateway
- AI Model/Tool Registry
- AI Inference Provenance
- Data Hub
- Metric Catalogue
- Workflow Engine
- Integration Framework
- Notification Infrastructure
- Marketing Data Engine
- Campaign & Attribution Engine
- Marketing Automation Engine
- Security/Safety Controls
- Billing & Entitlement Infrastructure

## 4. AI operating model

AI is a governed intelligence layer across modules, not a second source of canonical business truth. AI may analyse authorised tenant data, identify patterns, forecast outcomes, recommend actions, assist staff, explain anomalies, help configure integrations and operate approved tools within explicit policy boundaries.

Core AI capabilities include:

- management decision support;
- demand and revenue forecasting;
- customer segmentation and lifecycle intelligence;
- no-show and retention risk prediction;
- next-best-action recommendations;
- customer-service and receptionist assistance;
- professional copilot assistance;
- marketing and seller performance interpretation;
- anomaly and data-quality explanation;
- business planning and scenario analysis;
- governed tool use and workflow assistance.

Consequential actions remain constrained by tenant permissions, policy, consent, audit and human-approval requirements.

## 5. Composition rules

1. Every canonical business domain has one owning module.
2. Modules consume another module's data through contracts; they do not recreate its authority.
3. Internal engines are hidden from normal commercial allocation.
4. A tenant can receive one module or a composition of modules when dependencies are satisfied.
5. Vertical packs constrain eligibility but do not fork the codebase.
6. Business and Location scope must be preserved on all tenant-owned data.
7. AI assistants can advise and operate approved tools but cannot silently override deterministic business authority.
8. External integrations are governed through Integration Hub rather than independent credential stores.

## 6. Example tenant compositions

### Small appointment-led business
Appointments & Booking + Workforce & Staff + Service Catalogue + Commerce + Communications.

### Growth-oriented service business
Core operations + CRM & Customer Intelligence + Marketing + Analytics & BI + Customer Experience + AI Business Adviser.

### Retail/e-commerce business
Commerce + E-commerce & Online Store + Inventory & Purchasing + CRM + Marketing + Analytics & BI.

### Marketplace seller
Seller & Marketplace Management + Inventory & Purchasing + Commerce + Analytics & BI + Business Planning & Forecasting + AI Business Adviser.

### Multi-location enterprise
Operational modules + Integration Hub + Analytics & BI + Business Planning & Forecasting + CRM + Marketing + Customer Experience + governed AI assistants.

## 7. Further development rule

Capabilities that already belong to an existing owning module remain inside that module. A new commercial module is created only when the capability represents a distinct business product with a clear canonical domain boundary, independent commercial value and a valid tenant-installation contract.

When a requested capability is missing, the development plan must first determine whether it belongs inside an existing module. Only genuinely distinct domains should expand the commercial module catalogue.
