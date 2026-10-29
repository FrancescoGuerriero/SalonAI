# Point 12 — Retail, Universal Provider Connections and Tenant AI Expansion

**Planning lineage:** extends the architectural intent of Roadmap v2.9 and executes on the current v3.2 / Point 12 branch.  
**Production boundary:** source architecture and UI contracts only until separately approved activation steps are completed.

## 1. Tenant and vertical direction

AIIBP remains one shared platform codebase with no tenant forks.

Current/planned tenant blueprints:

- SalonAI — reference Salon tenant;
- Stylish — planned Salon tenant;
- Gut Instinct — planned Retail tenant.

Retail is a first-class vertical, not a Salon configuration hack. Retail terminology, compatible capabilities and installed modules are resolved through the same vertical/capability/product-composition contracts as Salon, Spa, Fitness and Plastic Surgery.

## 2. Module taxonomy

The management UI must distinguish three different concepts.

### Core Platform Modules

Always-on platform foundations such as tenant/business ownership, location scoping, identity, RBAC/effective authority, entitlements/product composition, configuration, audit/governance, privacy/consent, API/webhooks and AI Core.

### System Capabilities

Shared internal engines used by commercial modules, including Provider Connection Framework, Data Hub, Communications Engine, Campaign & Attribution Engine, Marketing Automation Engine, Analytics/BI Engine, AI Governance & Learning, background jobs, import/export and observability/health.

System capabilities must not be sold or represented as duplicate business products merely because they have operational UI.

### Commercial Modules

The existing 22 business-facing modules remain the commercial catalogue. A tenant product manifest determines installed, available, disabled and dependency-provided capabilities.

## 3. Canonical commercial ownership

### CRM & Customer Intelligence

CRM is independent from Marketing and owns:

- Customer 360;
- relationship and interaction history;
- lifecycle classification;
- segmentation;
- retention journey definitions/outcomes;
- customer intelligence read models that belong to the customer relationship domain.

Marketing may consume authorised CRM audiences. Marketing does not own canonical customer relationship state.

### Communications

Communications owns consent-aware delivery for both transactional and marketing use cases across:

- email;
- SMS;
- WhatsApp;
- future approved channels.

Examples include appointment/order confirmations, reminders, receipts, support conversations, newsletters, promotions, reactivation and campaign delivery.

Marketing may request campaign delivery, but the Communications module/engine remains transport, delivery-status, retry and channel-governance authority.

### Marketing

Marketing owns the business-facing advertising, campaign, audience-use, attribution and automation experience. It consumes:

- CRM audiences/segments;
- Communications delivery authority;
- provider connection evidence;
- Marketing Data/Data Hub evidence;
- campaign/attribution evidence;
- Analytics/BI.

It must not duplicate CRM records or email/SMS/WhatsApp transport implementations.

## 4. Universal Provider Connection Framework

Every provider-enabled module must reuse one connection architecture:

`Commercial module -> Provider Connection Framework -> Integration Hub -> Provider adapter -> canonical domain/data authority`

Examples:

- Marketing -> Google Ads / Meta Ads / Microsoft Advertising / Apple Ads;
- Analytics -> GA4 / Search Console / Bing Webmaster;
- Communications -> Twilio / SendGrid;
- Marketplace -> Amazon / eBay / Google Merchant Center;
- Accounting -> Xero / QuickBooks / future Sage/FreeAgent adapters;
- Payments -> Stripe / PayPal / Square;
- Calendar -> Google / Microsoft.

### Standard connection lifecycle

1. Choose provider.
2. Explain data/actions/scopes.
3. Authenticate securely.
4. Select provider account/organisation/property.
5. Bind to Business and optional Location scope.
6. Confirm permissions and read/write capability.
7. Configure sync/backfill policy where applicable.
8. Test connection.
9. Persist encrypted server-side credentials/tokens.
10. Show connection health, last sync and granted scopes.
11. Support reconnect, scope review and disconnect.

### Authentication modes

- OAuth providers use provider-hosted sign-in. AIIBP must not collect Google/Meta/Microsoft passwords itself.
- API credential providers use protected server-side credential entry. Secrets must be encrypted and never returned to ordinary UI after submission.
- Hybrid providers may require OAuth plus account/configuration identifiers.

Provider writes are separately governed from read/sync capability and require explicit permissions, policy, audit and human approval where consequential.

## 5. Priority provider families

### Advertising

P0: Google Ads, Meta Ads, Microsoft Advertising.  
Conditional: Apple Ads where the tenant has a relevant App Store/Maps advertising use case.  
Later/optional: Amazon Ads, TikTok, Pinterest, LinkedIn, Reddit, Snapchat and other supported channels.

### Measurement

P0: GA4, Google Tag Manager, Search Console, Bing Webmaster, Meta measurement/Conversions API where implemented.  
Optional: Microsoft Clarity, BigQuery and other analytics destinations/sources.

### Communications

P0: Twilio SendGrid for email and Twilio Messaging/WhatsApp for SMS/WhatsApp, while retaining provider-neutral transport contracts.

### Marketplace

P0 Retail: Amazon Seller Central/SP-API, eBay and Google Merchant Center.  
Later: Shopify, TikTok Shop and additional seller channels according to tenant need.

### Accounting

Provider-ready architecture must support Xero, QuickBooks and later approved accounting adapters through the same Provider Connection Framework rather than accounting-specific credential infrastructure.

## 6. Gut Instinct Retail composition

Initial planned commercial modules:

- Commerce;
- E-commerce & Online Store;
- Inventory & Purchasing;
- Memberships (optional but selected in the planning blueprint until owner acceptance); 
- Loyalty;
- Communications;
- Integration Hub;
- CRM & Customer Intelligence;
- Customer Experience;
- Marketing;
- Seller & Marketplace Management;
- Analytics & BI;
- Business Planning & Forecasting;
- AI Business Adviser;
- AI Retention Manager.

Salon-only appointment/stylist capabilities are not inherited by Retail.

A future Retail customer-concierge tool profile may share the AI Receptionist product family/brand, but it must not reuse the Salon receptionist's appointment dependency by bypassing capability contracts. Retail tools should instead be explicitly governed for product discovery, order/support, returns and other approved commerce/customer-service actions.

## 7. Stylish Salon composition

Stylish uses the Salon vertical and can consume the mature appointment/service/workforce capabilities together with Commerce, E-commerce, Inventory, Communications, CRM, Customer Experience, Marketing, Analytics, Business Planning and governed AI assistants.

No Stylish-specific code fork is permitted. Branding, terminology, modules, providers, policies and tenant AI knowledge are configuration/product-manifest concerns.

## 8. AI learning architecture

AIIBP distinguishes four governed learning layers.

### Layer 1 — General AI

Shared AIIBP reasoning, tool-use patterns, safety, generic business/customer-service capabilities and platform-wide model/evaluation conventions. Tenant-confidential data must not be silently incorporated into shared training.

### Layer 2 — Vertical AI

Domain-specific training/evaluation for Salon, Retail, Spa, Fitness, clinical/specialist and future verticals.

### Layer 3 — Tenant AI

Tenant knowledge, terminology, catalogue, policies, approved documents, workflows, tone and authorised tenant-specific examples. Knowledge retrieval/RAG updates should be used where model retraining is unnecessary.

### Layer 4 — Continuous Machine Learning

Governed ML derived from the tenant's accumulating operational evidence, for example demand, retention, purchase propensity, inventory/replenishment, campaign response and marketplace performance.

Continuous learning does not mean automatic production replacement. The lifecycle remains:

`Business data -> governed dataset/features -> offline training -> baseline comparison -> candidate -> evaluation -> human-controlled promotion -> production inference -> monitoring/drift -> controlled retraining`

## 9. UI acceptance requirements

Tenant administrators must be able to see:

- installed commercial modules;
- available commercial modules;
- core platform modules;
- system capabilities included by dependencies;
- provider connections grouped by business purpose;
- connection state, provider account, scope, last sync and health;
- setup/reconnect/disconnect actions when authorised;
- read-vs-write capability and approval status;
- AI learning/governance state without exposing sensitive credentials or cross-tenant evidence.

Suggested tenant module navigation:

`Overview | Installed Modules | Core Platform | System Capabilities | Connections | Available Modules`

## 10. Execution order

1. Canonical Core/System/Commercial module registry.
2. Retail vertical registration and compatibility audit.
3. Planned Stylish and Gut Instinct tenant blueprints.
4. Tenant-aware dashboard/module-state UI.
5. Universal Provider Connection Framework and reusable setup UI.
6. Marketing Command Centre provider/analytics presentation.
7. Marketplace Command Centre and Retail P0 seller integrations.
8. Accounting/provider-ready connection surface.
9. General -> Vertical -> Tenant -> Continuous-ML AI governance and UI.
10. Manual module/provider/tenant acceptance.
11. Separate controlled activation of live credentials, workers, historical backfills, provider writes, marketing sends, production model promotion and deployment.

## 11. Production safety

This development plan does not itself authorise production credentials, live provider connections, live sync workers, historical backfills, marketplace/provider writes, autonomous marketing sends, model promotion, continuous-retraining promotion or production deployment. Those remain explicit controlled release/operations steps after source, security, HCI, RBAC, tenant-isolation and rollback acceptance.
