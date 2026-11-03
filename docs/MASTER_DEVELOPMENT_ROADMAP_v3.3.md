# AI Intelligent Business Platform — Master Development Roadmap

**Version:** 3.3 — Core AI, 22 Modules & Tenant Delivery Focus  
**Approved:** 3 November 2026  
**Supersedes execution order in:** `MASTER_DEVELOPMENT_ROADMAP_v3.2.md`  
**Reference vertical:** SalonAI  
**Lead:** DEV1 / Product Owner

## 1. Production objective

AIIBP must reach a state where a new Business tenant can be created, assigned a supported vertical and an approved set of commercial modules, configured, validated and deployed from the **same shared codebase** without a tenant fork.

Execution is now frozen around five product pillars:

1. **AI Core** — shared governed AI services, agents, automation and module AI contracts.
2. **22 commercial business modules** — complete, entitlement-gated, composable and tenant-ready.
3. **Tenant provisioning** — Business/Location creation, module assignment, dependency closure, RBAC/configuration and readiness reporting.
4. **Essential integrations** — marketing/search, marketplaces/commerce and analytics/tracking.
5. **Production readiness** — security, tenant isolation, acceptance, provider activation, deployment and rollback.

No new commercial modules or secondary product features should be added until these pillars satisfy their exit gates.

## Current execution sequencing — owner direction, 3 November 2026 (evening)

The product owner explicitly **deferred tenant provisioning and the 22-module assignment implementation** and requested Marketing development next, specifically Google/Microsoft Search and Ads, technical SEO, monthly backlink outreach and article submissions from an approved pool of tenant-owned website articles. This is a **sequencing change only**, not removal of SaaS provisioning or reduction of the 22-module catalogue.

**Active immediate priority:** Marketing Search & SEO Operations, as specified in `docs/roadmap/point12-search-ads-seo-editorial-research-2026-11-03.md`:
1. S1 secure tenant-owned SEO inventory, technical audit, canonical/robots/sitemap and public-page verification;
2. S2 Search Console, Bing Webmaster REST and consented IndexNow submissions;
3. S3 Google Ads/Microsoft Ads, conversion/consent/attribution and read-only optimisation;
4. S4 approved article pool, **monthly editorial outreach**, publisher-permitted submissions and verified backlink health;
5. S5 measurable AI-search visibility and prioritised content improvement.

**Deferred until owner restarts it:** Section 5 Business/Location tenant onboarding and assignment workflow, plus non-blocking Core AI enhancements. Existing Business/Location authority and `marketing` entitlement enforcement are **not** deferred: every new Marketing feature must preserve them. External provider credentials, scheduled outreach, paid campaign mutations, link placements, bulk submissions and production workers remain blocked pending controlled acceptance and explicit activation. Do not claim guaranteed backlinks, rankings or indexing.

## 2. Platform invariants

`AIIBP Platform -> Vertical/Product Configuration -> Business -> Location -> Users/Resources`

- One shared codebase; no tenant forks.
- Commercial capability selection controls what each tenant receives.
- Internal dependencies are resolved automatically.
- Entitlement is separate from user RBAC.
- Business and Location isolation fail closed.
- Core AI is shared; module AI consumes it rather than creating parallel AI authorities.
- External providers sit behind AIIBP-owned contracts.
- Production credentials, workers, writes, migrations, backfills and model promotion require explicit activation.

## 3. Canonical commercial portfolio — 22 modules

The live registry is authoritative.

| # | Module | Current source state | Required next work |
|---:|---|---|---|
| 1 | Appointments & Booking | Operational surface exists; dependency/composition covered | Complete backend entitlement/API audit, role/location acceptance, production workflow acceptance |
| 2 | Workforce & Staff | Tenant/entitlement hardening present | Complete manual role/RBAC/staff-profile/rota acceptance |
| 3 | Service Catalogue | Management entitlement boundary present | Complete module acceptance, public/management separation and error-state acceptance |
| 4 | Commerce | Canonical transaction authority exists | Complete module entitlement/API audit, checkout/order/refund acceptance and provider/payment readiness |
| 5 | E-commerce & Online Store | Commercial surface and Commerce dependency exist | Complete operational acceptance, product/storefront module gating and tenant configuration |
| 6 | Memberships | Trusted tenant + commercial entitlement boundary present | Complete contract/lifecycle/manual acceptance and Commerce dependency verification |
| 7 | Inventory & Purchasing | Operational surface exists | Complete backend entitlement/API audit and stock/purchasing acceptance |
| 8 | Loyalty | Operational surface exists; Commerce dependency declared | Complete backend entitlement/API audit and earning/redemption acceptance |
| 9 | Communications | Staff APIs entitlement-gated; provider webhook boundary preserved | Complete SendGrid/Twilio provider acceptance, consent, retries and delivery evidence |
| 10 | Calendar Integration | Google calendar foundation exists | Complete module entitlement/API audit, staff two-way sync acceptance and Outlook decision/activation |
| 11 | Integration Hub | Shared provider connection framework exists | Complete tenant provisioning integration checklist, provider health/recovery and P0 provider acceptance |
| 12 | CRM & Customer Intelligence | Customer/lead tenant boundaries and Customer 360 foundations exist | Complete module/API acceptance, segmentation/lifecycle/consent evidence and disabled-module behaviour |
| 13 | Customer Experience | Commercial surface exists | Complete operational/API entitlement audit, feedback/recovery acceptance and CRM/Communications dependency checks |
| 14 | Marketing | Marketing/Data Connections B–N source contracts complete | Complete P0 provider acceptance, SEO/search integration, Ads, consent/attribution and browser acceptance |
| 15 | Seller & Marketplace Management | Amazon/eBay source/read-only Data Hub paths present | Complete Amazon/eBay provider acceptance and Google Merchant Center implementation/acceptance |
| 16 | Analytics & Business Intelligence | Governed reporting/BI and analytics entitlement present | Complete GA4/GTM/Search Console/Bing evidence, conversion tracking and tenant/module analytics acceptance |
| 17 | Business Planning & Forecasting | Forecast/planning operational surfaces exist | Complete evidence correctness, tenant scope, model/baseline and module acceptance |
| 18 | AI Business Adviser | Governed management analysis baseline exists | Complete reusable agent/tool contract, module entitlements, provenance and human-approval acceptance |
| 19 | AI Receptionist | Governed proposal-oriented baseline exists | Complete agent orchestration, booking/communications tools, escalation and tenant configuration acceptance |
| 20 | AI Retention Manager | CRM/analytics advisory foundations exist | Complete module entitlement/API acceptance, recommendation provenance and governed action handoff |
| 21 | AI Stylist Copilot | Governed staff-facing baseline completed on main | Complete tenant/module acceptance and production AI-service readiness; retain advisory/no-autonomous-write boundary |
| 22 | Clinical Records | Experimental, Plastic Surgery only | **Deferred from SalonAI production scope**; retain architecture and security gates, expand only for eligible specialist tenant |

### Portfolio rule

The global catalogue remains fixed at **22** for the initial production milestone. New modules enter only after the first tenant-provisioning and production-readiness gates pass.

## 4. Core AI — priority 1

### Completed foundation

- Shared AI module registered as a non-allocatable platform foundation.
- Tenant context, provenance and canonical-fact requirements are defined.
- Governed tool registry exists for customer, CRM, forecasting, Marketing, management and communications use cases.
- AI assistant modules depend on shared AI instead of owning parallel AI runtimes.
- External writes, automatic model promotion and production training default to disabled.
- No-show and demand/forecasting governed evaluation foundations exist.

### In progress / remaining

1. Define one reusable **AI agent runtime contract** for all business modules:
   - tenant/Location context;
   - permitted evidence sources;
   - tool allow-list;
   - RBAC and module entitlement checks;
   - approval policy;
   - audit/provenance;
   - timeout/retry/failure behaviour.
2. Complete shared agent orchestration and tool invocation boundary.
3. Map each AI-enabled module to approved tools and evidence contracts.
4. Add tenant-specific AI configuration without code forks.
5. Add prompt/tool-injection and cross-tenant isolation regression suites.
6. Complete model lifecycle/evaluation contracts and production inference readiness.
7. Keep autonomous consequential writes disabled until separately accepted.

**Exit gate:** AI assistants can reuse the same governed Core AI runtime across tenants and modules, with isolated context, auditable tools and explicit human/automation policy.

## 5. Tenant/SaaS control plane — priority 2

The modular registry/composition engine is source-complete enough to prove 22-module dependency closure, but tenant delivery is not complete until provisioning is operational.

### Required work

1. Create Business tenant.
2. Select vertical/product configuration.
3. Select commercial modules.
4. Resolve dependencies automatically.
5. Persist tenant manifest/revision and effective entitlement state.
6. Create Location(s).
7. Apply role/RBAC presets.
8. Configure module settings.
9. Configure branding/domain without source forks.
10. Configure provider/integration checklist.
11. Configure privacy/data-retention settings.
12. Generate tenant readiness report.
13. Support reversible module enable/disable changes.
14. Validate Business A/B and Location A/B isolation.

**Exit gate:** a new tenant can be configured and prepared for release from platform controls without modifying tenant-specific source code.

## 6. Marketing, search and SEO — priority 3

### P0 integrations

- Google Ads
- Microsoft Advertising / Bing Ads
- Google Search Console
- Bing Webmaster Tools
- Google Analytics 4
- Google Tag Manager

### SEO/search work

- route-aware titles/descriptions/canonicals/robots;
- public/private indexing boundaries;
- dynamic sitemap coverage for approved public entities/content;
- structured data from canonical verified business/service/product/staff data only;
- renderability/prerendering for search-critical routes where required;
- Core Web Vitals/image/layout/cache acceptance;
- Google/Bing ownership verification readiness;
- acquisition -> conversion -> booking/order/revenue attribution;
- AI-search/ChatGPT visibility work limited to technically valid public structured content, crawlability, semantic entity clarity and measurable referral/source evidence — no fabricated claim of guaranteed AI ranking/indexing.

### Current status

The provider registry already declares Google Ads, Microsoft Advertising, GA4, GTM, Search Console and Bing Webmaster as P0 provider contracts. Marketing/Data Connections source architecture and source-level B–N acceptance contracts exist. Provider credentials and live acceptance remain gated.

## 7. Marketplace and commerce integrations — priority 4

### P0

- Amazon Seller Central
- eBay
- Google Merchant Center / Google Shopping

### Current status

- Amazon Seller Central: catalogue, seller profiles, read-only Data Hub import, KPI projection and bounded backfill source contracts exist; provider acceptance pending.
- eBay: seller profiles and the same tenant/read-only/Data Hub controls exist; provider acceptance pending.
- Google Merchant Center: declared as a P0 provider for Seller Marketplace/E-commerce; operational implementation and acceptance remain to complete.

Provider writes such as listing/product mutations remain separately governed and are not required for the initial read/reporting production milestone unless explicitly approved.

## 8. Analytics and tracking — priority 5

Complete one tenant-aware measurement architecture rather than separate analytics stacks per module.

Required:

- GA4 integration;
- GTM integration;
- Google Search Console;
- Bing Webmaster evidence where applicable;
- conversion tracking;
- campaign/marketing attribution;
- booking/order/revenue reconciliation;
- tenant-level dashboards;
- module-level analytical projections where useful;
- provenance and source lineage;
- privacy/consent controls;
- no cross-tenant analytics aggregation unless explicitly authorised as anonymised/platform-level analytics.

## 9. Production readiness — priority 6

Required before production-ready status:

- current Fast CI, security, module and regression gates green;
- backend entitlement audit across all tenant-facing module APIs;
- module composition and disabled-module acceptance;
- role/RBAC acceptance;
- Business/Location isolation evidence;
- secrets/configuration readiness;
- representative provider sandbox/non-production acceptance;
- rate limits/retries/outage recovery;
- observability needed for production incidents;
- accessibility/responsive/browser acceptance for critical workflows;
- migration/backfill plan where required;
- explicit worker activation plan;
- release/deployment evidence;
- rollback procedure;
- post-deploy verification.

## 10. Work to pause or defer

Until the Core AI + 22 modules + tenant provisioning milestone is reached, do **not** prioritise:

- additional commercial modules beyond the current 22;
- additional verticals beyond proving the current tenant/vertical architecture;
- further commercial website/about/contact/brand polish beyond what is needed to sell/demo the platform;
- contact-form production delivery unless required for launch;
- optional provider expansion such as QuickBooks, Xero and Apple Ads unless a committed tenant requires it;
- Natural Computing production integration;
- experimental AI/model features without a current module requirement;
- autonomous provider writes or autonomous consequential AI actions;
- advanced marketplace write operations before read/reporting/attribution acceptance;
- Clinical Records expansion for SalonAI;
- cosmetic dashboard/navigation work that does not fix module discoverability, accessibility, broken workflows or acceptance blockers;
- duplicate analytics, CRM, communications, campaign or AI authorities.

Security, tenancy, audit, observability, accessibility and performance work remain in scope when they are required for production readiness.

## 11. Dependencies and blockers

| Dependency/blocker | Impact | Resolution order |
|---|---|---:|
| Tenant provisioning control plane not yet complete | Prevents repeatable no-fork tenant delivery | 1 |
| Core AI shared agent/tool runtime not fully production-accepted | Limits reusable AI automation across modules | 2 |
| Backend commercial entitlement coverage is not yet proven across every module API family | Risk of module access outside tenant allocation | 3 |
| Manual module/RBAC/tenant-isolation acceptance incomplete | Prevents commercial production claim | 4 |
| P0 provider credentials/test accounts not accepted | Blocks Ads/search/analytics/marketplace live evidence | 5 |
| Google Merchant Center operational path incomplete | Blocks full requested marketplace set | 6 |
| SEO dynamic/public entity/renderability acceptance incomplete | Blocks search-production readiness | 7 |
| Production activation/deployment/rollback evidence pending | Blocks final release | 8 |

## 12. Recommended implementation order

1. **Freeze scope at Core AI + current 22 modules.**
2. **Correct and lock the canonical roadmap/module inventory.**
3. **Finish Core AI shared agent/tool/runtime contracts and tenant isolation.**
4. **Finish tenant provisioning/module assignment control plane.**
5. **Audit and close backend entitlement/RBAC/Business/Location boundaries for all 22 module API families.**
6. **Run module-by-module operational acceptance and fix only blocking defects.**
7. **Complete P0 Marketing/Search/SEO integrations:** Google Ads, Microsoft Ads, Search Console, Bing Webmaster, SEO/indexing/structured data.
8. **Complete P0 Analytics/Tracking:** GA4, GTM, conversion tracking, attribution and tenant/module analytics.
9. **Complete P0 Marketplace integrations:** Amazon, eBay, Google Merchant Center.
10. **Run full tenant provisioning rehearsal:** create a new tenant, assign modules, configure Location/RBAC/providers, verify disabled modules and no code fork.
11. **Run production-readiness/security/provider/manual acceptance gates.**
12. **Only then consider secondary providers, extra modules, extra verticals or autonomous features.**

## 13. Initial production milestone definition

AIIBP reaches the initial production milestone when:

- one shared codebase can serve multiple Businesses;
- a tenant can be created without source changes;
- the tenant can be assigned only the required commercial modules;
- module dependencies resolve automatically;
- unassigned modules fail closed;
- Business/Location data isolation is evidenced;
- Core AI consumes only authorised tenant/module evidence and tools;
- required P0 integrations can be configured per tenant;
- critical module workflows pass role-based acceptance;
- production secrets/workers/migrations/providers are explicitly activated;
- deployment and rollback evidence exists.

That milestone takes precedence over all non-essential feature expansion.