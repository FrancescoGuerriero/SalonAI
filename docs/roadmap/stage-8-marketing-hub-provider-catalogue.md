# Stage 8 Marketing Hub — provider catalogue expansion

## Purpose

The Marketing Hub now exposes a broad governed provider catalogue while keeping implementation status explicit. A provider being visible in the catalogue does **not** mean live API execution is enabled.

Two states are used:

- **Configurable** — an account/auth contract already exists in the Marketing Hub. Live provider execution still remains acceptance-gated.
- **Planned** — the provider is included in product and architecture coverage, but its API/auth adapter, normalisation contract and controlled acceptance have not yet been completed. Configuration and live sync are disabled.

No production provider activation, data migration, backfill or external write is performed by this catalogue expansion.

## Existing configurable catalogue

- Google Ads
- Facebook Ads (Meta)
- LinkedIn Ads
- Microsoft Ads (Bing Ads)
- TikTok Ads
- Facebook Page Insights (Meta)
- Instagram Organic
- LinkedIn Pages
- Google My Business / Business Profile
- Google Analytics 4
- Google Search Console
- Bing Webmaster Tools
- Shopify
- Stripe
- HubSpot
- Mailchimp
- YouTube

## Added planned catalogue providers

### Advertising

- Amazon Ads
- Amazon DSP
- Apple Search Ads
- Facebook Lead Ads (Meta)
- Google Ad Manager
- Google Campaign Manager 360 (CM360)
- Google Display & Video 360 (DV360)
- Google Search Ads 360 (SA360)
- MNTN (mountain.com)
- OpenAI Ads / ChatGPT Ads
- Pinterest Ads
- Quora Ads
- Reddit Ads
- Shopee Ads
- Snapchat Ads
- Spotify Ads
- Twitter Ads
- Yahoo! Japan

### Marketplace and commerce

- Amazon Seller Central (Amazon SP)
- Amazon Vendor Central
- Google Merchant Center
- TikTok Shop

### Analytics, search and measurement

- Google PageSpeed Insights
- Microsoft Clarity
- Mixpanel
- Yandex Metrica

### Organic social and reputation

- Pinterest Organic
- Threads
- TikTok Organic
- Twitter Organic (Legacy)
- Yotpo

### CRM and marketing automation

- Gravity Forms
- MailerSend
- Microsoft Dynamics 365
- Reply.io
- Salesforce
- Salesforce Marketing Cloud
- SendGrid
- Zoho CRM

### Communications and collaboration

- Microsoft Teams
- Rocket.Chat
- Slack
- Twilio
- Twilio TaskRouter
- Zoom

### Data, warehouse and developer infrastructure

- Amazon SQS
- Docker Hub
- GitHub
- GitLab
- Google BigQuery
- Google Sheets
- Microsoft Dataverse
- MongoDB
- MySQL

### Finance and payments

- Exchange Rates
- PayPal Transaction
- QuickBooks
- Square
- Xero
- Yahoo! Finance Price

### Surveys and voice of customer

- SurveySparrow
- SurveyMonkey

### Web, SEO and competitive intelligence

- Google Webfonts
- Semrush

## OpenAI Ads note

OpenAI Ads / ChatGPT Ads is treated as a genuine planned provider, not an unverified placeholder. OpenAI currently documents an Advertiser API and Ads Manager. The SalonAI connector remains **planned** until its read/reporting adapter, authentication storage, field normalisation and acceptance tests are implemented in this repository.

## Governance boundary

Planned providers:

- return `configurable: false`;
- return `implementationStatus: planned`;
- expose no credential-entry form;
- cannot create an IntegrationConnection;
- cannot provision a MarketingDataSource;
- cannot execute live provider requests;
- remain visible in the Marketing Hub so the product roadmap and integration coverage are explicit.

The text fragment `Try it for freeLearn more` from the supplied provider list is intentionally excluded because it is page/UI copy, not a provider.
