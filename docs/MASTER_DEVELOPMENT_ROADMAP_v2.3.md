# SalonAI Master Development Roadmap

**Version:** 2.3 — Consolidated Development Baseline  
**Approved:** 21 September 2026  
**Status:** Authoritative development reference  
**Owner:** Developer 1 / Product Owner  
**Coordination:** Developer 2 + Developer 3 + Developer 4

> This document is the repository baseline for future SalonAI development. It supersedes older phase-number-only planning documents. Development should follow the dependency order below and preserve the permanent architectural rules.

## 1. Product direction

SalonAI is intended to evolve from a working salon application into an intelligent salon-management system, then a commercial multi-salon SaaS product and ultimately a broader salon technology platform.

The original long-range direction remains valid:

Commerce/Integrations → AI Consultation → Salon Operations → CRM/Retention → Python BI → AI Stylist Copilot → Marketing Automation → Inventory Intelligence → Multi-Tenant SaaS → SaaS Billing → API/Integrations → PWA/Mobile → Marketplace.

Execution is now dependency-driven rather than phase-number-driven because several capabilities were implemented earlier than originally planned.

## 2. Governance and developer ownership

- **Developer 1** — application builder, architecture owner, integration owner and release coordinator.
- **Developer 2** — independent error/quality auditor for bugs, regressions, UI/UX, accessibility and resilience.
- **Developer 3** — independent feature/dashboard completeness auditor for missing or incomplete product behaviour and management workflows.
- **Developer 4** — AI Business Platform SaaS architecture: multi-tenancy, multi-location, vertical families, capability packs, entitlements, tenant isolation, shared AI architecture and multi-vertical expansion.
- Developer 2/3 findings feed the Developer 1 backlog and should not create competing product implementations unless a narrowly scoped corrective patch is delegated.
- One authoritative GitHub repository is the source of truth.
- `main` is integration/release only. Feature work uses short-lived branches and PRs.
- Developer 1 remains final integration and production-release authority.
- Developer 4 implementation proceeds only when the SalonAI baseline is stable enough for the relevant migration.

## 3. Target product architecture

### Customer experience
Discovery, booking, account, commerce, loyalty, consultation, reviews and communications.

### Salon operations
Appointments, smart booking, walk-ins/queue, group bookings, service packages/trials, internal calendar, employees, customers/CRM, services, inventory, payments and reporting.

### AI platform
Chatbot, consultation support, recommendations, forecasting, segmentation, no-show models, copilot and automation.

### Integration layer
Twilio, SendGrid, Stripe, Google, Microsoft, accounting, POS, social and local-search providers.

### Platform services
Authentication, RBAC, audit, APIs, CI/CD, containers, observability, backup/restore, SLOs and governed releases.

### SaaS layer
Multi-salon tenancy, branches, plans, billing, platform administration and later marketplace services.

### Marketing Data & Attribution Core
Provider-neutral internal aggregation for connector ingestion, campaign data, social publishing, SEO intelligence, attribution, analytics and content workflows. First-party connectors should be preferred over making one external aggregation vendor canonical.

## 4. AI-native principles

- AI is a platform capability, not a single feature.
- Use generative AI, ML, deep learning, NLP, predictive analytics, recommendations, computer vision and intelligent automation only where they provide measurable business value.
- Build one shared AI foundation now.
- Business-specific AI customisation is deferred until SalonAI and shared AI services are mature.
- Future tenant-specific AI should be created through tenant knowledge, configuration, permissions, tools, policies and models, not codebase forks.
- AI actions must respect RBAC, consent, tenant boundaries, audit, policy controls and human-approval thresholds.
- The AI Adviser should become the primary business-facing AI interface, grounded in SalonAI operational data and approved knowledge, with evidence/provenance.

## 5. Permanent architectural rules

1. SalonAI owns canonical business data. External providers extend SalonAI; they do not replace its state or permissions.
2. Raw card data must never be stored by SalonAI. Use PCI-compliant provider flows and tokenised/provider transaction references.
3. SalonAI Appointment records and internal calendar own scheduling state.
4. Twilio is the communications family: Programmable Messaging for SMS/WhatsApp and Twilio SendGrid for email/marketing.
5. Authentication and provider authorisation are separate concerns.
6. Public/customer flows must never create or elevate staff roles.
7. Production changes occur only through immutable releases and protected deployment workflows.
8. Duplicate functions, duplicated business rules and parallel sources of truth are prohibited unless explicitly justified and documented.
9. Performance and download efficiency are permanent requirements.
10. Tenant-aware design may be introduced early where it prevents future rework, but full tenant-specific AI customisation and automated SaaS provisioning remain later phases.

## 6. Current maturity baseline

| Area | Status | Remaining focus |
| --- | --- | --- |
| Core foundation | Complete | MERN/API/MongoDB/services/stylists/appointments; ongoing maintenance |
| Commerce | Advanced | Business acceptance, refunds/invoice enhancements; card-present later |
| Salon operations | Advanced | Internal calendar UX and permissions |
| Inventory | Partial | Purchasing intelligence and automation |
| Customer platform | Advanced | Self-service, favourites, reviews, wallet, inbox |
| AI foundation | Advanced | Productionise Python AI service, forecasting, segmentation, no-show, management copilot |
| Production engineering | Strong | Continuous hardening |
| Communications | Partial | Complete SendGrid transactional + marketing |
| Identity & RBAC | In progress | Complete Super Admin/delegated permissions and social authentication |
| Smart calendar | In progress | Internal calendar, customer export, optional employee two-way sync |
| Smart booking & walk-ins | Planned/design | Walk-ins, queue/check-in, group bookings, packages, trials |
| SEO/growth | Partial | Local, performance and content work |
| CRM & retention | Planned/partial | Customer 360 and lifecycle automation |
| BI / Python analytics | Planned/partial | Management BI |
| AI Stylist Copilot | Planned | Professional decision support |
| Marketing automation | Planned | Journeys, campaigns and AI-assisted optimisation |
| Inventory intelligence | Planned | Predictive replenishment and supplier/margin intelligence |
| Multi-tenant SaaS | Planned | Tenant isolation, organisations, branches and control plane |
| SaaS billing | Planned | Subscriptions and entitlements |
| API & integrations | Foundation | Public API/webhooks/accounting/POS |
| PWA/mobile | Planned/partial | Installability and mobile/offline capabilities |
| Marketplace | Long term | Discovery, cross-salon availability and platform transactions |

## 7. Functional integrity, UX and code-health gate

Before major feature batches:

- Audit each major function for purpose, users/roles, entry points, authoritative data source, permissions and overlaps.
- Consolidate substantially duplicated functions behind one authoritative implementation.
- Audit employee management, statuses, bookability, service assignment, permissions, appointments, calendars, communications, settings, toggles, reports and AI tools.
- Organise navigation around user tasks, not internal code structure.
- Hide irrelevant/unauthorised areas while preserving the underlying permission model.
- Use progressive disclosure for advanced controls.
- Periodically remove dead code, duplicate utilities/components, unused dependencies, CSS overrides, redundant API calls, oversized bundles and unnecessary payloads.
- Optimise the full path: database → backend/API → network → frontend → browser.

## 8. Identity, authentication and permissions

Identity/RBAC must be completed before deeper calendar, CRM, communications, AI-action and SaaS automation.

Current/target capabilities:

- Email/password retained.
- Forgot/reset password built.
- Email verification built.
- Refresh/session resilience built.
- Super Admin architecture established.
- Delegated RBAC foundation established.
- Google/Facebook/Microsoft/Yahoo customer login in social-authentication work.
- Connected sign-in accounts should support explicit provider link/unlink.
- Matching email alone is not sufficient proof to link an external identity.
- Customer social login should request identity/basic-profile scopes only.
- Staff calendar OAuth is a separate consent flow, preferably with separate app registrations.
- Super Admin has full authority.
- Admin/Receptionist/Manager/Stylist capabilities are permission-driven.
- Customer capabilities remain customer-only.

## 9. Smart Calendar

SalonAI Appointment records and the internal calendar remain canonical.

Required staff calendar capabilities:

- Day/week/month views.
- Create appointment.
- Open appointment details.
- Edit/reschedule with availability and conflict validation.
- Cancel/change status with delegated permissions.
- Preserve status history, actor identity, reminders and audit.

Required permissions:
`appointment:read`, `appointment:create`, `appointment:update`, `appointment:cancel`.

Customer calendar export is one-way convenience:
- Add to Google Calendar.
- Add to Outlook.
- Download .ics.

Employee external calendars:
- Google Calendar and Outlook/Microsoft 365 optional.
- Connected and Sync ON/OFF are separate states.
- Dedicated Calendar Connections UI.
- Reconnect/disconnect, last sync, health/errors and permissions.
- Provider-to-SalonAI mutations only for linked appointment events and only after SalonAI validation.
- Use delta/sync checkpoints, webhooks/subscriptions, idempotency, replay protection, reconciliation, retries and observability.
- Support non-appointment time-off/meeting/training blocks.

## 10. Smart Booking and Walk-In Management

Extend the canonical booking domain; do not create parallel booking engines.

Capabilities:
- Walk-in check-in, optional queue, estimated wait/position, assignment and conversion into canonical appointment/service lifecycle.
- Service packages with validity, credits/sessions, eligible services/staff/locations and auditable redemption.
- Group bookings with organiser plus participant-level service/staff/duration/consent/payment state.
- Controlled service trials with pricing, duration, eligibility and conversion tracking.
- Front-desk workflow for arrivals, waiting, in-service, completed, cancelled/no-show and unassigned walk-ins.
- Customer-facing package/group/trial options without complicating standard one-person booking.

Rules:
- One booking/availability engine.
- Respect staff/service/location/schedule/break/time-off/resource/permission/tenant rules.
- Package/trial redemption must be transactional and auditable.
- Group partial changes must be safe.
- Manual receptionist queue control comes before AI optimisation.
- Do not duplicate customer/order/payment records by booking type.

## 11. Communications

Twilio remains the communications family.

- WhatsApp: Twilio Programmable Messaging.
- SMS: Twilio Programmable Messaging.
- Transactional email: Twilio SendGrid.
- Marketing/newsletters: Twilio SendGrid Marketing Campaigns/Single Sends.

Safeguards:
- Separate transactional and marketing preferences.
- Use suppression/unsubscribe groups.
- Record consent and opt-out history.
- Respect WhatsApp 24-hour/template rules.
- Preserve delivery-status callbacks.
- Do not expand bot/WhatsApp scope during immediate calendar/auth work.

## 12. Customer Experience completion

Preserve and complete:
- Appointment self-service.
- Book Again.
- Favourites.
- Verified reviews.
- Inspiration board.
- Consultation history.
- Loyalty wallet.
- Gift cards.
- Offers.
- Referral centre.
- Customer inbox.
- Communication preferences.
- Privacy/consent centre.
- Feedback/NPS.
- Service packages.
- Group bookings.
- Service trials.
- Walk-in customer status.

## 13. SEO and growth

Target measurable bookings and revenue:
- Renderability/prerendering/hybrid strategy.
- sitemap.xml, robots.txt, canonicals and private-route noindex.
- Service slugs, stylist pages, product pages and useful public content.
- HairSalon/LocalBusiness, Service, Product, Breadcrumb and eligible Person/review structured data.
- Google Business Profile alignment.
- Bing/search-engine verification.
- Core Web Vitals, image/CDN optimisation, route splitting, caching and layout stability.
- Privacy-aware acquisition-to-booking/revenue analytics.
- Feed growth data into the Marketing Data & Attribution Core.

## 14. CRM and Retention

Evolve customer records into Customer 360:
- Visit, spend, service, stylist, consultation, communications, loyalty, gift-card, review and campaign history.
- Lifecycle states: new, active, VIP, lapsing, dormant, recovered.
- LTV, churn/no-show risk and next-best-action signals.
- Consent-aware lifecycle triggers.
- Campaign-to-booking/revenue attribution.

## 15. BI and shared AI foundation

Build on Python AI and operational data:
- Revenue, appointments, cancellations, no-shows, utilisation and capacity.
- Retail sales, margins, inventory and supplier performance.
- Acquisition, retention, cohorts, LTV and campaign performance.
- Revenue/demand/staffing/inventory forecasting.
- No-show/churn models, segmentation and recommendations.
- AI management answers must expose metrics/evidence.

Shared AI architecture:
- AI Gateway/registry.
- Knowledge layer.
- Evaluation.
- Provenance.
- Model routing.
- Cost/usage controls.
- Tenant-safe context.

## 16. AI Stylist Copilot

Professional decision support, distinct from customer chatbot:
- Summarise appointment/consultation/preferences/history.
- Surface previous services/products and follow-up.
- Assist with consultation summaries and aftercare/product/service context.
- Human stylist remains responsible for professional decisions.
- Audit AI inputs/outputs and restrict sensitive data by role/consent.

## 17. Marketing Automation

Use CRM, consent, SendGrid/Twilio, analytics and shared AI:
- Onboarding.
- Post-visit follow-up.
- Birthdays.
- Colour-maintenance reminders.
- Lapsed recovery.
- VIP journeys.
- Abandoned booking/cart.
- Product replenishment.
- Referral/seasonal/service-launch/newsletter campaigns.

AI may recommend audience/content/timing; sending remains governed by consent, policy and human-approved automation rules.

## 18. Inventory & Product Intelligence

- Retail vs salon-use stock.
- SKU/barcode and cost history.
- Suppliers, POs, goods received and supplier performance.
- Low-stock thresholds.
- Intelligent reorder recommendations.
- Demand forecasting.
- Margin/dead-stock/seasonal analysis.
- Feed recommendation performance back into purchases/retention.

## 19. Multi-Tenant SaaS

Developer 4’s AI Business Platform plan is the detailed companion.

Principles:
- SalonAI is the reference implementation.
- Do not fork per business/vertical.
- Promote shared services only after proven in SalonAI.
- Tenant-specific differences belong in configuration, capability packs, knowledge, policy and entitlements.
- Introduce tenant isolation only after single-salon domain/RBAC/integration maturity.
- Tenant-scope employees, customers, appointments, inventory, payments, settings and integrations.
- Target hierarchy: Platform Super Admin → Salon Owner → Organisation/Branch Admin → Manager → Receptionist/Stylist.
- Tenant-aware audit, jobs, analytics, storage, webhooks and secrets.
- Existing salon becomes the reference tenant.

## 20. SaaS billing, integrations, card-present, mobile and marketplace

### SaaS billing
Salon pays SalonAI:
- Plans, entitlements and limits.
- Employee/branch/AI/communications/integration allowances.
- Stripe subscriptions, invoicing/customer portal.
- Later usage-based metering if justified.
- Grace periods, suspension/recovery and auditable billing.

### API ecosystem
- Versioned `/api/v1`.
- OpenAPI.
- API keys/OAuth, scopes and rate limiting.
- Signed webhooks, idempotency, retries, dead-letter handling and integration health.
- Xero, QuickBooks, POS, Meta/Instagram and Google Business Profile adapters where justified.
- Provider-specific adapters behind provider-neutral business contracts.

### Integrated card payments — later stage
- PCI-compliant card-present terminal/POS adapters.
- Tenant/location-aware terminal and merchant mapping.
- Link transactions to canonical appointment/order/invoice/customer.
- Capture/void/refund/receipt with RBAC/audit.
- Settlement/reconciliation and mismatch reporting.
- Never store PAN/CVV.
- Start only after online payments, commerce, RBAC, audit and integration contracts are stable.

### PWA/mobile
- Responsive web remains primary.
- Installable PWA.
- Safe offline shell.
- Push notifications.
- Touch-first calendar/booking/upload.
- Resilient sessions.
- Native apps only after usage proves the need.

### Marketplace — long term
- Salon/stylist/service discovery.
- Real-time participating-salon availability.
- Reviews, public profiles, products and recommendations.
- Clear commercial model and salon ownership of customer relationships.

## 21. Permanent engineering track

| Track | Permanent requirement |
| --- | --- |
| Security | RBAC, secure sessions, encryption, secret hygiene, CodeQL, Trivy, dependency/secret scanning |
| Privacy | GDPR, consent, minimisation, retention/deletion, audit trails, marketing preferences |
| Testing | Backend/API, component, Playwright E2E, accessibility, visual/responsive |
| Operations | Observability, SLOs, alerts, backups, restore drills, incident response, disaster recovery |
| Delivery | PR-only integration, fresh CI, immutable releases, release evidence, smoke, rollback |
| Performance | Bundle/Core Web Vitals, API latency, database indexes, queues/background jobs, provider resilience |
| Functional integrity | One source of truth per business rule; remove duplicate workflows/settings |
| UX / IA | Task-oriented navigation, role-relevant menus, consistent terminology, progressive disclosure |
| Code health | Dead-code removal, duplicate consolidation, dependency pruning, modular boundaries, CSS cleanup |
| AI governance | Central AI gateway, evaluation, provenance, permissions, human approval, cost controls, tenant-safe context |

## 22. Execution order from the current checkpoint

1. **Repository and product reconciliation gate** — re-check current main, open PRs/issues, CI/security and production baseline.
2. **Functional duplication + UX/IA audit** — consolidate duplicate functions and rationalise navigation/placeholders.
3. **Code-health and performance baseline** — measure bundle, route load, API latency and queries; set recurring budgets.
4. **Identity, Super Admin and delegated RBAC completion**.
5. **Internal Calendar completion**.
6. **Smart Booking & Walk-In Management**.
7. **Customer calendar export**.
8. **Employee calendar connection + two-way sync**.
9. **Twilio/SendGrid communications completion**.
10. **Customer experience completion**.
11. **SEO + Marketing Data & Attribution Core**.
12. **CRM & Retention**.
13. **Python BI + shared AI foundation**.
14. **AI Stylist Copilot + cross-platform AI**.
15. **Marketing automation**.
16. **Inventory intelligence**.
17. **DEV4 SaaS foundation**.
18. **Shared SaaS AI + tenant AI customisation framework**.
19. **SaaS billing + self-service onboarding**.
20. **Multi-vertical validation** — Spa AI first, then MedSpa/clinical and other verticals.
21. **Integrated card payments — later stage**.
22. **API/ecosystem, PWA/mobile and marketplace**.

## 23. Decisions incorporated in v2.3

- AI is the principal long-term product direction.
- Developer 4 owns the SaaS/multi-tenant/multi-vertical companion architecture.
- Business-specific AI customisation is deferred until shared AI and the single-business application are mature.
- Functional duplication, code duplication, complexity and performance are recurring governance checks.
- Dashboard/side-menu must be rationalised around tasks, permissions and shared capabilities.
- Marketing Data & Attribution Core is provider-neutral, not Windsor.ai-dependent.
- Calendar providers share one internal contract; employee connection and sync are separate states; customer export is one-way.
- Multi-tenant conversion begins from a stable SalonAI baseline with trusted membership/tenant identity.
- Walk-ins, group bookings, packages and trials extend the canonical booking/availability domain rather than creating parallel systems.

## 24. Current execution notes

As of 21 September 2026:

- v8.15.10 is the verified production baseline before the v2.3 reconciliation work.
- Functional duplication/navigation audit is active under Issue #227.
- Frontend performance/bundle-budget work is active under Issue #229.
- Duplicate Admin route aliases have been redirected to canonical workspaces.
- Shared optional assistant loading and bundle budgets have been introduced.
- Repeated premium list-page UI has been consolidated.
- Team working-hours/time-off has been clarified as the canonical **Team availability** workspace.

Future architecture or roadmap changes that affect AI, tenancy, vertical strategy or canonical booking/commerce behaviour must update this roadmap and the Developer 4 AI Business Platform companion plan together.
