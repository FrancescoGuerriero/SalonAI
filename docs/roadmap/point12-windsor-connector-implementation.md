# Point 12 — Windsor Marketing connector plugin

Date: 26 October 2026  
Module: Marketing  
Status: source implementation in progress; production/provider activation not authorised.

## 1. Purpose

The Windsor plugin is an internal Marketing-module connection layer for broad read/analytics connectivity. A Business can authorise only the sources it needs, Windsor retrieves provider data, AIIBP binds the resulting Windsor account IDs to that Business, and the Marketing/Data Hub surfaces tenant-scoped evidence for dashboards and governed AI assistance.

This does **not** replace native AIIBP provider adapters. The two connection modes have different purposes:

- **Windsor** — broad source coverage, read/analytics ingestion, field discovery and rapid SaaS onboarding.
- **Native AIIBP adapters** — deeper first-party verification/control and any later provider-specific write operations that need AIIBP-owned policy/audit contracts.

The UI must present one provider once and identify the available connection mode(s), not duplicate the provider as separate products.

## 2. Authoritative Windsor implementation documentation

Primary documentation:

- Connectors API: `https://windsor.ai/api-documentation/`
- API host: `https://connectors.windsor.ai`
- Connector discovery: `GET /list_connectors?api_key=...`
- Field schema: `GET /{connector}/fields?api_key=...`
- Data query: `GET /{connector}?api_key=...&fields=...`
- Connection metadata: `GET https://onboard.windsor.ai/api/mcp/connectors/{connector}/connect-info?api_key=...`
- Single-source co-user authorisation: `GET https://onboard.windsor.ai/api/team/generate-co-user-url/?allowed_sources={connector}&api_key=...`
- Linked-account reconciliation: `GET https://onboard.windsor.ai/api/team/co-user-linked-accounts/?api_key=...&access_token=...`
- Account unlink: `DELETE https://onboard.windsor.ai/api/team/co-user-linked-accounts/?api_key=...&ds_id=...&account_id=...&access_token=...`

`connect-info` is the key UI contract. Windsor returns:

- `auth_type`: `oauth` or `manual`;
- a temporary `connect_url`;
- the manual credential-field definitions where applicable;
- `required` and `sensitive` flags for those fields.

The Windsor URL contains a temporary access token and must be treated as a secret. It must not be written to ordinary application logs or support diagnostics. Sensitive provider fields must never be echoed back after entry.

The Connectors API currently authenticates using the `api_key` query parameter. `WINDSOR_API_KEY` therefore stays server-side; the browser never receives the account API key.

## 3. Multi-tenant SaaS mapping

Authorisation is scoped as:

`AIIBP Business -> Windsor authorisation session -> connector -> Windsor account IDs`

The server stores:

- Business ID;
- optional selected Location ID;
- product connector key;
- resolved Windsor connector ID;
- hashed authorisation-session identifier;
- encrypted temporary co-user access token;
- reconciled Windsor account IDs/names;
- timestamps/status.

Every data preview must prove that the requested Windsor `account_id` exists in the active Business connection metadata. The API must fail closed on an unowned account ID.

Different businesses can therefore have completely different connector sets without code forks. Business allocation remains governed by the tenant product/capability configuration; source-account choice remains tenant data.

## 4. Sources, sellers and destinations are distinct

The supplied Windsor list contains different integration roles. They must not appear as one undifferentiated list.

### Data sources

Advertising, analytics, CRM, social, finance and other systems that AIIBP can query for evidence.

### Sellers

Seller/e-commerce operational evidence receives a dedicated Marketing subsection:

- **Amazon Seller Central (Amazon SP)** — Windsor connector `amazon_sp`.
- **eBay** — Windsor connector `ebay`.
- Amazon Vendor Central and TikTok Shop may also appear in Sellers where available to the tenant.

### Data platforms

Warehouse/database/file connectors can act as data platforms and may support source and/or destination workflows depending on Windsor capability, for example BigQuery, Redshift, S3, MongoDB, MySQL, Dataverse and Google Sheets.

### Destinations / AI destinations

ChatGPT, Claude, Copilot Agent and Power BI are presented as downstream destinations/analysis surfaces, not as ordinary Marketing source accounts. Destination activation is a separate workflow from source authorisation.

## 5. Seller implementation references

### Amazon Seller Central (Amazon SP)

Windsor field reference: `https://windsor.ai/data-field/amazon_sp`

Current Windsor reference exposes 915 fields (394 metrics, 521 dimensions), including order/report evidence. Windsor also documents write-capable listing actions; **AIIBP Point 12 does not enable those write actions**. Seller data is read/analytics by default and any later listing mutation requires a separate permission, approval and audit contract.

If AIIBP later implements a direct Amazon SP-API adapter, use Amazon Selling Partner API developer/app registration and OAuth/LWA requirements rather than asking users for Amazon passwords.

### eBay

Windsor field reference: `https://windsor.ai/data-field/ebay`

Current Windsor reference exposes 103 fields (43 metrics, 60 dimensions), including orders, order lines, listing traffic and Promoted Listings campaign performance.

Official direct-API references for any later native connector:

- OAuth authorisation: `https://developer.ebay.com/develop/guides/sell/authorization`
- Sell Finances API: `https://developer.ebay.com/develop/api/sell/finances_api`

Direct eBay user data requires OAuth user consent. OAuth tokens/refresh tokens are confidential; provider passwords must not be collected by AIIBP.

## 6. Requested connector inventory

The product catalogue records the following requested connections. Live Windsor connector IDs/auth requirements are resolved from Windsor discovery/connect-info instead of freezing credential forms in AIIBP.

### CRM, lifecycle and automation

ActiveCampaign; Gravity Forms; HubSpot; Klaviyo; MailerSend; Microsoft Dynamics 365; Reply.io; Salesforce; Salesforce Marketing Cloud; Zoho CRM.

### SEO, search and competitive intelligence

Ahrefs; Bing Webmaster Tools; Google PageSpeed Insights; Google Search Console; Semrush; Yandex Metrica.

### Advertising

Amazon Ads; Amazon DSP; Apple Search Ads; Facebook Ads (Meta); Facebook Lead Ads (Meta); Google Ad Manager; Google Ads; Google Campaign Manager 360 (CM360); Google Display & Video 360 (DV360); Google Search Ads 360 (SA360); LinkedIn Ads; Microsoft Ads (Bing Ads); MNTN; OpenAI Ads / ChatGPT Ads; Pinterest Ads; Quora Ads; Rakuten Advertising; Reddit Ads; Shopee Ads; Snapchat Ads; Spotify Ads; TikTok Ads; Twitter Ads; Yahoo! Japan.

### Organic/social/content

Facebook Page Insights (Meta); Instagram Insights; Instagram Public Data; LinkedIn Pages; Pinterest Organic; RSS; Threads; TikTok Organic; Twitter Organic (Legacy); YouTube.

### Sellers and marketplaces

Amazon Seller Central (Amazon SP); Amazon Vendor Central; eBay; Google Merchant Center; Shopify; TikTok Shop; Yotpo.

### Finance/payments/commerce

Bling!; Exchange Rates; PayPal Transaction; QuickBooks; Square; Stripe; Xero; Yahoo! Finance Price.

### Data/warehouse/developer platforms

Amazon Redshift; Amazon S3; Amazon SQS; Docker Hub; GitHub; GitLab; Google BigQuery; Google Sheets; Google Webfonts; Microsoft Dataverse; MongoDB; MySQL.

### Collaboration, communications and work management

Microsoft Teams; Monday; Rocket.Chat; SendGrid; Slack; Twilio; Twilio TaskRouter; Zoom.

### Product/app analytics and voice of customer

AppFollow; Google Analytics 4; Microsoft Clarity; Mixpanel; Survey Sparrow; Surveymonkey.

### Destinations / AI analysis surfaces

ChatGPT; Claude; Copilot Agent; Power BI.

## 7. UI contract

Marketing now has one module landing page with internal workspaces:

- Windsor data connections;
- native connections;
- Sellers;
- journeys/automation;
- attribution/performance;
- AI marketing assistant.

The Windsor UI provides:

- connector search/filter;
- separate Sources, Sellers, Data platforms, Destinations and AI destinations;
- current connection state;
- `Connect securely` action;
- Windsor/provider OAuth/manual hosted setup;
- `Check connection` reconciliation;
- Business-bound account list;
- read-only data preview;
- account unlink;
- explicit unavailable/not-configured states.

For OAuth connectors, AIIBP must never render a provider-password field. For manual connectors, Windsor's setup screen is preferred so provider API keys/secrets need not be stored in AIIBP.

## 8. AI assistance boundary

AI may assist with:

- connector discovery and explaining setup requirements;
- recommending which data sources are relevant to the Business;
- detecting missing/broken connections;
- field selection/mapping suggestions;
- data-quality/anomaly explanations;
- metric interpretation and dashboard summaries;
- suggesting campaign or commercial actions based on evidence.

AI must not:

- obtain or display provider passwords;
- reveal `WINDSOR_API_KEY` or temporary authorisation tokens;
- connect/unlink an account without the authorised user action;
- query a Windsor account not bound to the active Business;
- execute a Windsor write action automatically;
- present model output as canonical data.

## 9. Environment and production requirements

Required server environment variable:

`WINDSOR_API_KEY=<team-owner API key>`

Before production activation:

1. Confirm Windsor commercial plan/limits support expected tenants, connector count and refresh cadence.
2. Confirm API-key storage is production-secret-manager backed.
3. Confirm no access-token-bearing Windsor URL is logged by reverse proxy/APM/application logs.
4. Perform Business A / Business B isolation tests with different Windsor authorisation sessions.
5. Confirm account unlink cannot cross Business boundaries.
6. Confirm provider terms/required approvals for any connector used commercially.
7. Confirm privacy/retention policy for source data copied into AIIBP.
8. Keep all Windsor write-capable actions disabled until separately implemented and approved.
9. Run manual acceptance from `point12-business-module-boundaries.md` plus seller/Windsor cases.

No production provider connection, migration, scheduled sync or write action is authorised by this implementation record.
