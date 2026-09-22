# AI Intelligent Business Platform — Master Development Roadmap

**Version:** 2.9 — Staged HCI + AI/ML Baseline  
**Approved:** 22 September 2026  
**Status:** Authoritative staged development reference  
**Reference vertical:** SalonAI  
**Developer 1:** Application / Integration / Release Lead  
**Coordination:** Developer 2 + Developer 3 + Developer 4

> This is the repository execution baseline for the owner-approved **AI Intelligent Business Platform Master Development Roadmap v2.9**. It supersedes v2.3 as the active planning authority while preserving all code, PR, issue, release and architectural evidence already produced under earlier baselines. Older roadmap files remain historical records and must not be interpreted as instructions to recreate completed work.

## 1. Product hierarchy and direction

The umbrella product is **AI Intelligent Business Platform (AIIBP)**.

- **SalonAI** is the reference salon vertical used to prove capabilities before shared-platform promotion.
- **Spa AI**, **Fitness AI**, **Plastic Surgery AI** and later Developer-4-defined products reuse shared platform services through configuration, capability packs, tenant knowledge and vertical-specific modules.
- New verticals must not be created by copying the SalonAI codebase.

The long-range product direction remains commercially recognisable, but execution is now staged by technical dependency and release gates rather than old phase numbers.

## 2. Developer ownership and governance

### Developer 1 — Application, Integration and Release Lead

- Owns the SalonAI reference application and ordinary frontend/backend/integration implementation unless explicitly delegated.
- Owns cross-workstream integration, conflict resolution, release preparation, deployment evidence, rollback readiness and production go-live.
- Converts this roadmap into current-main implementation order.
- Decides when a SalonAI contract is mature enough for Developer 4 platform promotion.

### Developer 2 — UI, HCI, Accessibility, Errors and Experience Quality

- Audits UI/layout consistency, responsive behaviour, accessibility, usability evidence, modal containment, visual regressions and user-facing error quality.
- Uses the HCI lifecycle: research -> prototype -> test -> refine -> implementation validation.
- May provide narrowly scoped UI patches when delegated; does not create competing business rules or permissions.

### Developer 3 — Dashboard, Staff, Employee Management and RBAC Completeness

- Audits staff/employee management, dashboard completeness, role/permission administration, account workflows and management-surface integrity.
- Verifies Super Admin/Admin visibility and delegated-role boundaries.
- Audits side-menu/dashboard features for placeholders, duplicates and inconsistent sources of truth.

### Developer 4 — SaaS, Multi-Tenant, Multi-Vertical and Shared Platform Architecture

- Owns AIIBP tenancy, locations, vertical families, capability packs, entitlements, tenant isolation, Configuration Studio and reusable shared services.
- Promotes proven SalonAI capabilities into shared platform modules.
- Owns later tenant-aware AI architecture and multi-vertical expansion.
- Does not replace Developer 1 application/release work, Developer 2 HCI work or Developer 3 staff/RBAC work.

### Common stage workflow

Every stage follows:

1. **PLAN** — confirm scope, dependencies, source of truth, acceptance criteria and affected contracts.
2. **IMPLEMENT** — dedicated branch/PR; reuse canonical services instead of creating parallel implementations.
3. **AUDIT** — DEV2 HCI/accessibility, DEV3 staff/RBAC, DEV4 platform/tenancy as relevant.
4. **INTEGRATE** — DEV1 resolves conflicts and checks current CI/security/tests.
5. **RELEASE** — DEV1 controls immutable release, deployment and production verification.
6. **REVIEW** — fold findings into roadmap/issues and re-check duplicate functions and UX complexity.

## 3. Permanent architectural rules

1. AIIBP owns shared platform contracts; each vertical/tenant owns its canonical business data.
2. External providers extend the platform; they do not replace canonical business state, permissions or tenant boundaries.
3. SalonAI Appointment records and internal calendar remain authoritative for salon scheduling.
4. Raw PAN/CVV/card data must never be stored; payments use PCI-compliant provider flows and tokenised/provider references.
5. Twilio is the communications family: Programmable Messaging for SMS/WhatsApp and SendGrid for email/marketing.
6. Authentication and provider authorisation remain separate concerns. Customer social sign-in is identity-only; staff calendar OAuth is separate.
7. Public/customer flows must never create or elevate a staff role.
8. Production changes occur only through immutable releases and protected deployment workflows.
9. Duplicate business rules, competing sources of truth and copied workflow implementations are prohibited unless explicitly justified.
10. Performance/download efficiency is permanent: measure bundles, payloads, API latency and database behaviour.
11. Tenant-aware design may be introduced early only when it prevents future rework; full tenant customisation/provisioning is later-stage.
12. Provider independence is mandatory; provider-specific adapters sit behind provider-neutral business contracts.
13. Integration data retains source IDs and provenance while mapping into shared normalised facts/dimensions.
14. External write actions are permission-checked, policy-checked, auditable and human-approved by default.
15. Owner/admin interfaces use business language and task-based workflows; technical diagnostics belong in advanced views.
16. Experimental connectors and AI automation remain feature-flagged until health, audit and rollback are proven.
17. Material user-facing changes use proportionate HCI evidence; technical functionality alone is not release acceptance.
18. Desktop/tablet/mobile interfaces must remain usable within the viewport with keyboard access, focus visibility, readable typography, contrast and labelled forms.

## 4. Current SalonAI reference-vertical maturity

The current application already contains substantial work that must be preserved.

- Core MERN/API/MongoDB/services/stylists/appointments foundation: mature.
- Commerce: advanced; online checkout exists, later reconciliation/refund/invoice/card-present work remains.
- Salon operations: advanced; employee, availability, calendar and reception work already exists.
- Inventory: partial; intelligence/automation later.
- Customer platform: advanced but incomplete.
- Python AI/ML service: advanced foundation; formal AI APIs, experiment governance, RAG/evaluation/MLOps progression remain.
- Production engineering: strong CI/CD, Docker, release evidence, observability and rollback discipline.
- Communications: partial; Twilio work exists; SendGrid completion and WhatsApp restoration remain later-stage.
- Identity/RBAC: substantial foundation already merged; production provider acceptance remains.
- Smart calendar: in progress.
- Smart booking/walk-ins: active Stage-2 authority in Issue #246.
- SEO/Marketing Data Core: later Stage-5 authority in Issue #248 / PR #249.
- AI/BI surface rationalisation: preserved for later Stage 8 in Issue #237.

## 5. HCI and user-centred design as a permanent track

HCI is not a one-off visual redesign. High-value customer, employee/reception and administrator journeys should use proportionate evidence:

- user groups/personas or journey profiles;
- task and workflow analysis;
- information architecture;
- low-fidelity flow/wireframe when useful;
- high-fidelity Figma prototype for materially changed interaction flows;
- usability review using completion rate/time, errors, navigation steps, assistance and satisfaction where practical;
- heuristic/cognitive walkthroughs;
- accessibility checks for keyboard, focus, labels, contrast, screen-reader compatibility and responsive fit;
- production re-check after implementation.

The existing UI should not be redesigned simply to produce artefacts. Prototype work is an interaction-risk control for material changes.

## 6. Shared AI/ML direction

AI is a platform capability rather than a single chatbot feature.

Shared AI/ML services should evolve around:

- AI Gateway/tool registry;
- governed Python AI service;
- knowledge/RAG and semantic retrieval;
- conversational AI;
- predictive ML and recommendations;
- explainability/provenance;
- experiment/dataset/model governance;
- MLOps;
- later Natural Computing optimisation;
- human approval for consequential actions.

Deterministic rules remain preferable where they solve a problem safely and predictably. ML must beat documented baselines before production promotion. Deep learning is introduced only when data and measurable benefit justify it.

### Internal AI stages

- **AI-1:** Python AI foundation, structured APIs, dataset/experiment conventions, evaluation/logging.
- **AI-2:** Knowledge ingestion, embeddings, semantic search and RBAC-aware RAG.
- **AI-3:** SalonAI reference AI Adviser.
- **AI-4:** Staff and Management Copilot.
- **AI-5:** Predictive ML — no-show, demand, retention, revenue, service/stock.
- **AI-6:** Explainable recommendation systems.
- **AI-7:** Scheduling/search/optimisation comparison.
- **AI-8:** Advanced conversational intelligence and multi-channel interaction.
- **AI-9:** Computer-vision research with consent/safety boundaries.
- **AI-10:** Natural-language Business Intelligence.
- **AI-11:** MLOps, lineage, monitoring, controlled retraining/rollback.
- **AI-12:** Shared cross-vertical AIIBP services.

## 7. Natural Computing research track

Natural Computing is a later research-first workstream after reliable data, predictive ML, RAG/AI Adviser and baseline scheduling/optimisation exist.

Mandatory lifecycle:

**UNDERSTAND -> IMPLEMENT -> APPLY -> COMPARE -> EVALUATE -> INTEGRATE**

Candidate families include PSO, GA, DE, DFO, SDS and carefully justified ACO/SOMA or other methods.

Production promotion requires comparison against appropriate exact optimisation, constraint programming, conventional heuristics and ML-supported approaches under equivalent computational budgets. Stochastic algorithms require repeated seeds and reproducible statistics.

Internal Natural Computing stages:

- **NC-1:** fundamentals/problem abstractions;
- **NC-2:** common seeded implementations;
- **NC-3:** recognised benchmarks;
- **NC-4:** repeated-run statistical evaluation;
- **NC-5:** controlled AIIBP synthetic problems;
- **NC-6:** optimisation sandbox;
- **NC-7:** convergence/parameter/Pareto visualisation;
- **NC-8:** controlled production optimisation service for validated algorithms only;
- **NC-9:** authorised AI Adviser integration;
- **NC-10:** research-only LLM-guided metaheuristics before any later optimisation-agent work.

## 8. Staged development roadmap

### Stage 0 — Reconcile & stabilise

**Lead:** DEV1  
**Gate:** current main/production understood; critical regressions closed or owned; duplicate functionality mapped; performance and HCI risks recorded.

Work includes repository/product reconciliation, open PR/issue review, production parity, CI/security state, duplicate-function audit, route/load/API/database performance baseline and current-production HCI audit.

### Stage 1 — Identity, permissions & UX/HCI foundation

**Lead:** DEV1  
**Support:** DEV2 HCI/accessibility; DEV3 RBAC/staff; DEV4 tenant-aware review.  
**Authority:** Issue #253.

Deliverables:

- preserve Super Admin/delegated RBAC and customer identity/social-login contracts;
- role-aware navigation and side-menu rationalisation;
- simple vs advanced management presentation;
- representative personas/journeys/task analysis;
- Figma/component prototype baseline for material interaction changes;
- keyboard/focus/contrast/form-label standards and representative browser acceptance.

**Gate:** authorised users see relevant tasks; protected actions enforce permissions server-side; no competing staff/management workflows remain; representative flows are understandable and meet the agreed accessibility baseline.

### Stage 2 — Core salon operations

**Lead:** DEV1  
**Authority:** Issue #246.

Internal calendar, schedule blocks, staff/service eligibility, canonical Smart Booking, walk-ins/reception, packages, group bookings and trials. All modes reuse one booking/availability engine.

### Stage 3 — Communications, calendars & commerce

**Lead:** DEV1  
**Authority:** Issue #236 for communications.

Complete Twilio/SendGrid, restore WhatsApp booking/consultation, customer calendar export, employee Google/Microsoft sync and online payment/refund/invoice/reconciliation lifecycle.

### Stage 4 — Customer experience, CMS & reputation

Self-service, favourites, reviews, loyalty/wallet, inbox, consent/preferences and a structured Content Studio with versioned draft/preview/publish workflows and media optimisation.

### Stage 5 — SEO, measurement & Marketing Data Core

**Authority:** Issue #248 and preserved PR #249.

Technical SEO, unified event taxonomy, connector framework, first-party source onboarding, data preview/field catalogue, scheduled/incremental sync, backfill, raw + normalised data and connector health.

### Stage 6 — Cross-channel campaigns, social & attribution

One master Campaign -> multiple provider executions, social publishing, review/reputation hub, calculated fields, blended data, campaign IDs/UTMs and deterministic attribution.

### Stage 7 — CRM, retention & marketing automation

Customer 360, lifecycle states, segmentation, consent-aware journeys and campaign-to-revenue measurement using shared customer, consent, campaign and communications services.

### Stage 8 — BI, AI/ML research, AI Adviser, Natural Computing & advanced intelligence

**Authority note:** Issue #237 tracks AI/BI surface rationalisation.

Management BI; AI-1..AI-12 progressively; AI Gateway; RAG; adviser family; predictive ML; recommendations; explainability; selected computer-vision research; then NC-1..NC-10 only after predictive/AI Adviser/baseline optimisation maturity.

### Stage 9 — DEV4 SaaS foundation

Trusted BusinessMembership/tenant resolver, canonical SalonAI reference tenant, locations, tenant-scoped domains, entitlements, capability packs, Configuration Studio and tenant-safe jobs/webhooks/analytics.

### Stage 10 — Tenant AI, commercialisation & i18n

Tenant knowledge/configuration/policies/tools, SaaS billing, self-service onboarding, white-label branding and locale/timezone/currency/data portability without code forks or cross-tenant data leakage.

### Stage 11 — Card-present, API ecosystem & mobile

PCI-compliant card-present/POS integration, settlement reconciliation, accounting-ready exports/connectors, versioned APIs/webhooks and mature PWA/mobile role workspaces using shared domain rules.

### Stage 12 — Multi-vertical & marketplace expansion

Validate Spa AI, then clinical/MedSpa and other verticals through shared services/capability packs. Marketplace work follows tenancy/API/commercial maturity. Repeated core-code copying is an architecture defect.

## 9. Permanent stage-gate checks

Every stage begins from **current `main`**, not from the roadmap’s historical snapshot.

Before closing a stage:

- review current open PRs/issues and preserve legitimate later-stage work;
- re-run duplicate-function/source-of-truth audit;
- verify frontend/backend/AI tests, CodeQL/security gates and relevant browser tests;
- compare performance against current budgets/baselines;
- record HCI evidence proportionate to user-facing change;
- document migrations, rollback/fallback and production acceptance where relevant;
- ensure no feature silently bypasses RBAC, consent, audit, tenant or provider boundaries;
- update issue/roadmap status so completed work is not rediscovered and rebuilt later.

## 10. Current reconciliation at v2.9 activation

At activation of Stage 1, repository `main` is already ahead of the last published production release. Therefore source maturity and production maturity must be tracked separately.

Completed work from earlier roadmaps is retained, including employee/RBAC consolidation, navigation de-duplication/progressive disclosure, performance budgets, social-auth readiness, internal calendar blocks, waitlist conversion, walk-in/reception foundation and the service-package transactional foundation.

Open work is preserved by authority rather than copied into new issues:

- **#253:** v2.9 Stage 1 identity/permissions/UX-HCI.
- **#246:** Stage 2 Smart Booking/Walk-In/packages/groups/trials.
- **#236:** Stage 3 unified communications.
- **#248 / PR #249:** Stage 5 SEO/Marketing Data Core.
- **#237:** Stage 8 shared AI/BI surface rationalisation.

## 11. Definition of roadmap compliance

A feature is not complete merely because code exists. Completion requires the relevant combination of:

- canonical architecture and no competing source of truth;
- tests and security gates;
- permission/audit correctness;
- performance acceptance;
- HCI/accessibility evidence for material user-facing changes;
- production/release evidence where deployed;
- roadmap/issue status updated to reflect actual completion.

This document is the active repository planning authority from v2.9 onward.