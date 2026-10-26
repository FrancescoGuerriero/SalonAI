# AI Intelligent Business Platform — Master Development Roadmap

**Version:** 3.1 — Commercial Acceptance, Module Rationalisation & SaaS Activation  
**Approved:** 26 October 2026  
**Status:** Next authoritative execution reference after Point 12 commercial source closure  
**Reference vertical:** SalonAI  
**Lead:** DEV1 / Product Owner

> Roadmap v3.1 supersedes v2.9 as the forward execution authority after the Point 12 source baseline. Historical roadmap, issue, PR, release and production evidence remains valid. This roadmap must not be used to rebuild capabilities already present in current `main`.

## 1. Strategic transition

AIIBP has moved from broad feature construction into **commercial acceptance and controlled productisation**.

The immediate objective is not to add every conceivable feature. It is to prove that the existing platform can be configured as distinctive modules for different Businesses, that each enabled module has one clear authority, that provider connections are safe and operable, that user journeys are coherent, and that the selected tenant configuration can be released and supported commercially.

The governing invariant remains:

> **AIIBP owns the capability; each Business owns its configuration, data and experience.**

## 2. Permanent architecture and product rules

1. One shared AIIBP codebase; tenant code forks are prohibited.
2. Canonical business-domain ownership is singular; duplicate sources of truth are defects.
3. Business -> Location -> users/resources/data is the tenancy hierarchy unless a domain is explicitly Business-wide.
4. Capability entitlement and user permission/effective authority remain distinct controls.
5. External providers extend AIIBP; they do not become the canonical authority for appointments, customers, staff, commerce, campaigns or tenant identity.
6. Integration records retain provider IDs/provenance and map into normalized platform evidence.
7. Provider secrets remain server-side/encrypted and are never exposed in normal UI/logging.
8. External write actions are permission/policy/audit checked and human-approved by default.
9. AI consumes canonical evidence and is advisory by default; model output is not canonical business state.
10. Internal implementation engines are not exposed as duplicate commercial modules.
11. HCI/accessibility acceptance is required for material customer/staff/admin workflows.
12. Production changes require immutable release/deployment/runtime verification and rollback evidence.
13. Optional unconfigured providers must be shown as unavailable/not configured, not treated as application defects.
14. New development first extends the existing canonical authority; a new domain is created only when semantics are genuinely new.

## 3. Canonical commercial module catalogue

The module tidy-up must converge on the following business-facing catalogue. Internal engines may support these modules but must not appear as separate sellable duplicates.

| Module | Primary authority |
| --- | --- |
| Appointments & Booking | booking, availability, appointment lifecycle, queue/front desk |
| Workforce & Staff | employee/staff ownership, eligibility, assignments |
| Service Catalogue | service/procedure configuration |
| Commerce | order, checkout, payment/refund/invoice/reconciliation workflows |
| Memberships | membership lifecycle/recovery |
| Inventory & Purchasing | products/stock/suppliers/purchasing/replenishment |
| Loyalty / Stored Value | loyalty, gift/package/value entitlements and ledgers |
| Communications | message templates, consent-aware delivery and delivery evidence |
| Calendar Integration | external calendar connections/synchronization/export |
| Integration Hub | provider credentials, connections and sync contracts |
| CRM & Customer Intelligence | Customer 360, lifecycle, segmentation, retention definitions |
| Analytics & BI | deterministic metrics, Data Hub analytical evidence and reporting |
| Marketing | campaigns, journeys, attribution, automation, native/Windsor data connectivity |
| AI Business Adviser | management decision support |
| AI Receptionist | conversational front-desk/customer assistance |
| AI Retention Manager | retention decision support |
| AI Stylist Copilot | professional appointment/consultation decision support |
| Clinical Records | specialist clinical authority only for eligible verticals |

Internal examples such as Marketing Data Core, campaigns-attribution engine, marketing-automation engine and shared AI Gateway are dependencies, not commercial modules.

## 4. Execution model from v3.1

Each commercialisation slice follows:

**RECONCILE -> TEST -> AMEND -> ACCEPT -> RELEASE -> VERIFY**

- **RECONCILE:** map routes/components/services to one commercial module and one canonical authority.
- **TEST:** automated plus owner/manual representative workflows.
- **AMEND:** fix concrete defects, duplicates, unclear UX or provider-contract problems.
- **ACCEPT:** retain evidence for tenant isolation, RBAC, HCI/accessibility and enabled providers.
- **RELEASE:** immutable tagged build and protected production deployment.
- **VERIFY:** runtime identity, P0/smoke, provider acceptance and rollback evidence.

Feature expansion should not bypass unresolved commercial acceptance of the affected module.

# PHASE A — Commercial acceptance & module tidy-up

**Priority:** immediate  
**Goal:** turn the existing broad application into a clean configurable product catalogue.

## A1. Owner-led manual application acceptance

Run the application end-to-end with representative roles and at least two test Businesses/configurations.

Record defects only from observed behaviour:

- broken/duplicated routes;
- overlapping module functions;
- role/permission leakage;
- Business/Location leakage;
- confusing terminology;
- inaccessible/overflowing dialogs/popovers;
- inconsistent loading/error/empty states;
- non-responsive layouts;
- workflows requiring unnecessary technical knowledge.

Output: one prioritised acceptance defect list.

## A2. Module route/navigation rationalisation

For every navigation item/page/API family:

- assign one business-facing module owner;
- merge/remove duplicate user-facing surfaces where semantics overlap;
- preserve internal services where they provide distinct implementation responsibility;
- hide internal engines from tenant module allocation;
- verify enabled/disabled capability state consistently affects navigation and dedicated APIs.

Gate: no two commercial routes claim the same primary business task without an explicit reason.

## A3. Business module allocation UI

Build/finalise the tenant configuration experience over the existing capability/vertical/product-manifest authority:

- show business-facing modules only;
- show dependencies in business language;
- support enabled/disabled state and inherited/default configuration;
- preserve locks/provenance where applicable;
- do not let entitlement imply user permission;
- preview effective module set before applying configuration.

Gate: two Businesses can hold different module sets without code forks or cross-tenant state leakage.

## A4. HCI/accessibility acceptance

DEV2-style audit is now an acceptance lane, not a competing feature stream:

- keyboard/focus;
- labels/status/errors;
- modal/popover viewport containment;
- responsive desktop/tablet/mobile;
- progressive disclosure for advanced configuration;
- business-language copy.

Amend only demonstrated interaction defects.

# PHASE B — Provider & integration commercial activation

**Dependency:** Phase A module boundaries accepted.

## B1. Windsor Marketing provider acceptance

Use Point 12 as the source baseline.

Acceptance sequence:

1. protected `WINDSOR_API_KEY` configuration;
2. logging/APM secret-leak audit;
3. Business A/B + Location A/B isolation;
4. ordinary marketing/analytics connector acceptance;
5. Amazon Seller Central acceptance if commercially enabled;
6. eBay acceptance if commercially enabled;
7. curated profile/live-field reconciliation;
8. Data Hub import;
9. manual/hourly/daily/weekly scheduling validation;
10. adaptive historical backfill and saturated-day handling;
11. seller KPI comparison against provider-native evidence;
12. disconnect/reconnect/revocation recovery;
13. production worker activation only after acceptance.

Provider writes remain disabled under this phase.

## B2. Native provider matrix

Maintain one provider activation matrix by tenant/module, covering as applicable:

- Twilio SMS/WhatsApp;
- SendGrid email;
- Google/Microsoft calendars;
- Google/Facebook/Microsoft/Yahoo/LinkedIn customer identity;
- advertising/analytics/CRM/commerce providers;
- native connections that offer deeper platform control than Windsor.

Unconfigured optional providers are not blockers for tenants that do not purchase/use them.

## B3. Integration health/supportability

Commercial connector requirements:

- connection state and last success/failure;
- understandable recovery action;
- credential rotation/revocation path;
- idempotent retries;
- provider-rate controls;
- source provenance;
- audit trail;
- support diagnostics that redact secrets;
- tenant-safe unlink/deactivation.

# PHASE C — SaaS commercial control plane

**Goal:** make tenant provisioning, packaging and commercial administration repeatable.

## C1. Generic tenant provisioning

Reactivate generic Tenant-2 provisioning only against current canonical domains/capability packs.

Provision:

- Business;
- Location(s);
- tenant product manifest;
- selected modules/capabilities;
- baseline roles/effective authority;
- required configuration defaults;
- tenant-safe connector/app roots;
- audit/provenance.

Gate: a second genuine test tenant can be provisioned without manual database surgery or a code fork.

## C2. Subscription/billing/entitlement administration

Implement commercial plan authority without mixing it with RBAC:

- product/plan catalogue;
- module entitlements;
- quantity/location constraints where relevant;
- billing state and grace/suspension semantics;
- invoice/subscription provider integration behind a provider-neutral contract;
- plan changes with effective-date/audit history.

Permissions remain user authority; subscription state controls commercial capability availability.

## C3. Configuration Studio completion

Business/Location configuration should cover:

- brand identity;
- module settings;
- provider bindings;
- working practices/policies;
- inherited values + explicit overrides + locks/provenance;
- feature/experimental flags;
- privacy/retention settings;
- AI policies/tools allowed for the tenant.

## C4. White-label, locale and portability

After tenant provisioning is stable:

- branding/theme/domain configuration;
- locale/timezone/currency;
- export/data portability;
- tenant deletion/offboarding lifecycle;
- no tenant-specific source forks.

# PHASE D — Data, BI & AI production promotion

**Authority:** continue current Stage-8/#237 lineage rather than creating a parallel AI programme.

## D1. BI surface rationalisation

- canonical metric catalogue;
- shared dimensions/provenance;
- saved views/materialised read models where scale requires;
- module dashboards consume the same evidence;
- duplicate metric computation removed.

## D2. Data Hub destination execution

Current destination/write tasks remain preview/gated until:

- provider-specific action contract;
- permissions/policy;
- audit/idempotency;
- rate limiting;
- rollback/compensation where applicable;
- manual approval experience;
- tenant acceptance.

## D3. RAG/Business Adviser production maturity

- RBAC-aware knowledge ingestion/retrieval;
- citation/evidence provenance;
- evaluation datasets and quality thresholds;
- prompt/tool policy;
- cost/latency budgets;
- failure and fallback behaviour.

## D4. Predictive ML promotion

No-show, demand, retention, revenue/service/stock models require:

- sufficient real tenant data;
- deterministic/statistical baseline;
- train/validation/test discipline;
- repeatable experiment record;
- bias/error analysis as relevant;
- model registry/promotion gate;
- inference monitoring/drift;
- rollback/fallback.

## D5. AI action proposals

AI may propose a campaign, staffing adjustment, retention action or other consequential operation. Production execution remains:

`Evidence -> AI proposal -> policy/permission -> human approval -> canonical action service -> audit/outcome`

No direct-write autonomous agent bypass.

# PHASE E — POS, public API & mobile workspaces

Begin after Phase C commercial control plane is stable.

- PCI-compliant card-present/POS providers;
- settlement/reconciliation evidence;
- accounting-ready export/connectors;
- versioned external API/webhooks;
- developer credentials/scopes/rate limits/audit;
- mature PWA/mobile workspaces reusing canonical domain rules.

# PHASE F — Multi-vertical commercial expansion

Promote proven platform capabilities into additional product compositions rather than cloned applications.

Recommended order:

1. SalonAI production tenant template;
2. second salon business configuration to prove multi-tenant flexibility;
3. Spa AI;
4. Fitness AI where capability fit is demonstrated;
5. clinical/Plastic Surgery/MedSpa only after clinical-record/privacy/specialist governance requirements are explicitly satisfied;
6. later verticals through reusable capability packs.

Clinical capabilities must never leak into tenants/verticals that do not require them.

# PHASE G — Advanced optimisation / Natural Computing research

Natural Computing remains a research-to-production track, not a commercial launch dependency.

Use only after reliable operational data and conventional baselines exist:

- exact/constraint/baseline heuristic comparison;
- seeded repeated experiments;
- equivalent computational budgets;
- convergence/parameter/Pareto evidence;
- controlled optimisation sandbox;
- production promotion only when measurable operational benefit exceeds simpler methods.

# 5. Current evidence states to preserve

The new roadmap must not reopen these solely because earlier roadmap wording is stale:

- Stage 2 core salon operations is complete/live with production evidence.
- Stage 1 source work is complete; optional social providers are an activation matrix, not a reason to rebuild identity/RBAC/navigation.
- Stage 3 has substantial production evidence for privacy/compliance, communications/calendar work; remaining providers should be treated as optional acceptance where source contracts exist.
- old Stage-5 issue #248 is historical/deferred authority and is superseded by later Marketing Data Core/Data Hub implementation evidence.
- Stage 7 CRM/retention/automation source foundation exists.
- Stage 8 Data Hub/AI rationalisation remains active forward work.
- Roadmap-v3.0 issue #280 is historical coordination evidence; its platform-first invariant survives into v3.1.
- Point 11 AI Stylist Copilot source baseline is complete.
- Point 12 Marketing/Windsor commercial source baseline is complete when PR #581 is merged.

# 6. Commercial release gate

A tenant/module release is commercially accepted only when all applicable items pass:

- current-main source implementation;
- no duplicate canonical authority;
- automated CI/security/specialist gates;
- tenant/location isolation;
- effective permission/RBAC;
- privacy/consent/audit;
- HCI/accessibility/manual acceptance;
- provider-console credentials/terms/webhooks/domains for selected providers;
- real-provider test for enabled external services;
- performance/rate/cost budgets;
- immutable release and protected deployment;
- deployed runtime/P0 smoke;
- rollback evidence;
- issue/roadmap/status record updated.

A failure in an unrelated legacy aggregate workflow may only be excepted when the exact failing job is inspected, the relevant feature-specific/security gates are green, and the exception is documented. Do not use broad exceptions to conceal an affected feature regression.

# 7. Immediate execution order

1. Merge Point 12 after exact-head relevant gates are green and any unrelated legacy exception is documented.
2. Run owner manual acceptance against current application.
3. Produce a defect/duplication list from observed manual tests.
4. Execute module/navigation tidy-up and business allocation UI amendments.
5. Re-run HCI/RBAC/tenant acceptance.
6. Activate/test only the external providers required for the first commercial Business.
7. Provision a second test Business with a deliberately different module/provider set.
8. Complete generic SaaS provisioning and commercial entitlement/billing controls.
9. Release the accepted tenant configuration through immutable deployment/P0/rollback gates.
10. Continue Stage-8 BI/AI production maturity without reopening canonical platform work already completed.

# 8. Definition of v3.1 success

Roadmap v3.1 reaches its first commercial milestone when:

- the application is expressed as a clean non-duplicated module catalogue;
- at least two Businesses run different module configurations safely;
- first commercial tenant provider set is accepted end-to-end;
- tenant provisioning is repeatable;
- commercial entitlement/billing authority exists;
- user journeys pass manual HCI/accessibility acceptance;
- selected production configuration has immutable release/deployment/P0/rollback evidence;
- remaining AI/provider/vertical expansions are optional staged enhancements rather than hidden launch blockers.
