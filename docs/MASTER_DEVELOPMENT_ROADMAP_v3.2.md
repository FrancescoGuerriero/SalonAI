# AI Intelligent Business Platform — Master Development Roadmap

**Version:** 3.2 — Modular SaaS Productisation & Tenant Delivery  
**Approved:** 26 October 2026  
**Status:** Forward execution authority after Point 12 modularisation  
**Reference vertical:** SalonAI  
**Lead:** DEV1 / Product Owner

> Roadmap v3.2 defines AIIBP as a modular SaaS platform. Historical development records remain evidence, but future product decisions must be expressed in AIIBP-native architecture and terminology.

## 1. Product model

AIIBP delivers custom-made SaaS platforms to different Businesses by composing approved modules from one shared platform codebase.

Governing hierarchy:

`AIIBP Platform -> Vertical/Product Configuration -> Business -> Location -> Users/Resources`

Governing commercial rule:

> A Business selects the modules it needs. AIIBP automatically resolves required internal/platform dependencies, applies tenant configuration and permissions, then delivers one coherent tenant product without creating code forks.

## 2. Non-negotiable platform invariants

1. **One shared platform codebase.** Tenant-specific behaviour comes from configuration, capability packs, themes, integrations and governed extensions.
2. **One canonical owner per business domain.** No two active modules may own the same operational truth.
3. **Commercial modules are independently selectable.** Internal dependencies are auto-resolved and are not separately sold as duplicate products.
4. **Commercial modules are composable.** All supported modules for a vertical must be able to form one valid installation plan.
5. **Business and Location isolation is mandatory.** Data, credentials, sources, dashboards, automation and AI context fail closed across tenant boundaries.
6. **Entitlement is distinct from RBAC.** A tenant must own a module before a user permission can expose it.
7. **External providers extend AIIBP; they do not define AIIBP.** Provider APIs and optional managed adapters sit behind AIIBP contracts.
8. **AI is governed assistance.** AI may analyse, recommend and use approved tools but does not silently become canonical authority.
9. **Production activation is explicit.** Source completion does not automatically activate credentials, workers, migrations, backfills, provider writes or model promotion.
10. **Commercial acceptance requires manual evidence.** Automated tests cannot substitute for representative browser, provider and tenant-isolation acceptance.

## 3. Commercial module portfolio

### Core operations
- Appointments & Booking
- Workforce & Staff
- Service Catalogue
- Commerce
- Memberships
- Inventory & Purchasing
- Loyalty
- Clinical Records where supported

### Customer, growth and communication
- Communications
- Calendar Integration
- Integration Hub
- CRM & Customer Intelligence
- Marketing
- Analytics & Business Intelligence

### AI assistants
- AI Business Adviser
- AI Receptionist
- AI Retention Manager
- AI Stylist Copilot

### Internal platform engines — not sold directly
- Shared AI platform
- Marketing Data Engine
- Campaign & Attribution Engine
- Marketing Automation Engine
- common identity/tenancy/RBAC/audit/observability infrastructure

## 4. Installation model

Commercial selection resolves to a dependency-closed installation plan:

`selected modules -> dependency closure -> vertical compatibility -> conflict checks -> tenant entitlement -> configuration -> deployment`

Examples:

- Calendar Integration automatically includes Appointments authority.
- Memberships and Loyalty automatically include Commerce where required.
- AI Receptionist automatically includes shared AI, Communications and Appointments.
- AI Stylist Copilot automatically includes shared AI, Appointments and Service Catalogue.
- Marketing automatically includes its internal data/campaign/automation engines plus Integration Hub, CRM, Communications and Analytics dependencies.

The tenant experiences the selected commercial module; internal capabilities remain implementation details.

## 5. Data connection strategy

AIIBP owns a provider-neutral Data Connections contract across Integration Hub and Marketing.

AIIBP owns:
- connection catalogue and entitlement;
- provider/account mapping;
- encrypted credential references;
- Business/Location isolation;
- Data Hub ingestion and lineage;
- sync cadence, retry and health;
- bounded historical backfill;
- rate budgets;
- seller KPI projections;
- management UI and AI interpretation.

Connection implementations may be:
- direct native provider adapters; or
- optional managed adapters behind the same AIIBP interface.

The commercial product does not expose implementation-adapter branding as a separate module.

## 6. AI operating model

AI assistants are business-facing modules where appropriate. The shared AI foundation remains internal.

AI may:
- summarise tenant-owned evidence;
- identify anomalies and opportunities;
- forecast/rank options where an approved model contract exists;
- recommend business actions;
- invoke explicitly authorised read/write tools within RBAC, consent and approval policy;
- explain why a recommendation was produced with provenance where required.

AI may not:
- cross tenant/location boundaries;
- reveal secrets;
- bypass canonical business modules;
- perform consequential provider actions without an approved action contract;
- present generated output as deterministic business evidence.

## 7. Current acceptance baseline

Point 12 establishes:
- machine-readable module ownership and dependencies;
- duplicate-domain prevention;
- commercial module dependency resolution;
- vertical-specific allocatable module lists;
- AIIBP managed data connections;
- Amazon/eBay seller connectivity and curated KPI profiles;
- Data Hub ingestion and lineage;
- manual/hourly/daily/weekly sync configuration;
- bounded adaptive historical backfill;
- persistent API request-budget controls;
- seller KPI projections from normalised evidence;
- provider-neutral Marketing customer UI;
- automated modular SaaS regression gates.

Production credentials/provider activation remain separately controlled.

## 8. Phase A — Module acceptance and tidy-up

**Goal:** prove every business-facing module is genuinely product-ready alone and in combinations.

Required work:
1. Run automated module installability audit for every supported vertical.
2. Run full-composition audit for every vertical.
3. Remove duplicate menu/workspace entries that expose the same authority under different names.
4. Ensure each commercial module has:
   - module landing page;
   - clear purpose;
   - entitlement gate;
   - RBAC gate;
   - empty/not-configured/error states;
   - auditability where state changes occur;
   - dependency-resolved installation contract;
   - manual acceptance checklist.
5. Validate disabled-module behaviour and cross-module navigation.
6. Record issues/amendments found during manual testing.

**Exit:** each supported module is independently selectable and multiple/all supported modules compose without duplicate authority or broken dependency.

## 9. Phase B — Commercial tenant provisioning

**Goal:** make the next tenant configuration repeatable rather than handcrafted in code.

Required work:
1. Tenant creation workflow.
2. Vertical selection.
3. Commercial module selection.
4. Automatic dependency closure.
5. Location creation.
6. Role/RBAC presets.
7. Theme/branding configuration.
8. Domain/routing configuration.
9. Provider/integration setup checklist.
10. Data/privacy/retention policy selection.
11. Tenant readiness report before release.
12. Reversible entitlement changes after launch.

**Exit:** a new tenant can be configured from platform capabilities without a tenant code fork.

## 10. Phase C — Provider and Data Hub production acceptance

**Goal:** verify real provider operations safely.

Required work:
- representative native and managed connection tests;
- Amazon/eBay seller acceptance where required;
- Business A vs Business B isolation;
- Location A vs Location B isolation;
- preview/import/scheduled sync/backfill/unlink;
- live field/profile validation;
- KPI reconciliation against provider-native reports;
- secret/logging review;
- rate-budget/load review;
- outage/retry/recovery testing;
- explicit production worker enablement only after acceptance.

## 11. Phase D — Commercial UX/HCI acceptance

**Goal:** make configured tenant products usable by real staff, not just technically complete.

Test by role:
- owner/super admin;
- manager;
- receptionist/front desk;
- professional/staff member;
- customer where public surfaces apply.

Measure:
- task completion;
- navigation clarity;
- error recovery;
- accessibility;
- mobile/responsive use;
- module terminology;
- cross-module continuity;
- perceived duplication/confusion.

## 12. Phase E — BI and AI operational acceptance

**Goal:** validate evidence and recommendations before expanding autonomy.

Required work:
- metric correctness against canonical domains;
- seller/marketing KPI verification;
- AI provenance and tool authorization;
- offline evaluation for model-backed features;
- human approval for consequential recommendations/actions;
- prompt/tool injection resistance;
- tenant-isolation tests for AI context;
- monitored production pilots before broader enablement.

## 13. Phase F — Next tenant delivery

For each new tenant:

1. capture business requirements;
2. select vertical or custom terminology profile;
3. select commercial modules;
4. generate dependency-resolved installation plan;
5. configure locations/users/RBAC;
6. configure branding/domain;
7. configure integrations/data connections;
8. migrate/import only approved data;
9. run automated gates;
10. run manual role-based acceptance;
11. issue tenant readiness report;
12. create immutable release/deployment evidence;
13. verify production and rollback readiness.

## 14. Phase G — Expansion without architecture duplication

Future modules must enter through the same process:

`domain definition -> ownership decision -> dependency contract -> allocatable/internal classification -> tenant entitlement -> UI -> tests -> manual acceptance`

No new feature may create a parallel customer, booking, payment, campaign, message, credential, analytics or AI authority merely for convenience.

## 15. Release gate

A platform/tenant release is commercially ready only when:

- relevant Fast CI/security/module gates are green or an exception is explicitly documented;
- module composition is valid;
- tenant/location isolation has evidence;
- secrets/configuration are ready;
- manual acceptance is recorded;
- known limitations are documented;
- rollback is defined;
- production activation is explicit and auditable.

## 16. Immediate next execution order

1. Complete Point 12 modularisation/de-branding CI.
2. Run the full module installability/composition report.
3. Perform user-led manual module testing and record amendments.
4. Produce the updated platform development/readiness report from tested evidence.
5. Tidy navigation and module presentation based on findings.
6. Build/finish the tenant provisioning control plane.
7. Configure the next custom tenant using module selection and dependency resolution.
8. Run tenant-specific acceptance and controlled release.
