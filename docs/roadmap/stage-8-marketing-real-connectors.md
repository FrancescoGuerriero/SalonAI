# Stage 8 Marketing Hub — real connector contract

## Rule

A provider is not considered connected merely because credentials were saved. A Marketing Hub provider can be presented as connectable only when all of the following exist in source:

1. a provider-specific credential/account schema;
2. secure encrypted credential storage through the shared credential authority;
3. a real read-only provider account verification request to the provider's authoritative API;
4. a successful verification result persisted on the `IntegrationConnection`;
5. fail-closed handling that returns the connection to `pending` when verification fails.

A successful account connection is distinct from a Data Hub ingestion adapter. The UI/API must state whether the account is verified and whether ingestion is available. No connector may imply live sync merely because account authentication succeeded.

## Verified account connectors

The Marketing Hub now contains provider-specific credential schemas and live verification implementations for the existing core marketing connectors plus the expanded requested inventory. The implemented waves cover Google/Meta/LinkedIn/Microsoft/TikTok core marketing accounts, Amazon/AWS, Apple Ads, Google enterprise marketing/data products, Pinterest, Reddit, Salesforce, Semrush, SendGrid, TikTok Shop/Organic, Twilio, X, accounting/payment providers, survey systems, collaboration systems and developer/data services.

Representative verified connectors include:

- Google Ads — OAuth refresh/access token + developer token; Google Ads API customer verification.
- Google Analytics 4 — OAuth; configured-property verification.
- Google Search Console — OAuth; configured-property membership check.
- Facebook Ads / Meta Ads — Meta access token; configured ad-account lookup.
- LinkedIn Ads — OAuth; configured ad-account verification.
- TikTok Ads — advertiser access token; advertiser identity verification.
- Amazon Ads / DSP — Login with Amazon OAuth credentials; accessible advertising-profile verification.
- Amazon Seller Central / Vendor Central — SP-API Login with Amazon credentials; marketplace/vendor API access verification.
- Amazon SQS — AWS access credentials; SigV4-signed read-only verification.
- Apple Search Ads — OAuth2 client credentials backed by the Apple Ads private key; API-user verification.
- OpenAI Ads / ChatGPT Ads — Advertiser API key; ad-account verification.
- Pinterest Ads / Organic — OAuth; authenticated Pinterest account verification.
- Reddit Ads — OAuth2; configured ad-account verification.
- Salesforce / Salesforce Marketing Cloud — provider OAuth/server-to-server credentials; tenant/user verification.
- Semrush — API key; entitlement/API-unit verification.
- SendGrid — API key; authenticated user-profile verification.
- Twilio / TaskRouter — Account SID/Auth Token; account/workspace verification.
- X Ads / X Organic — OAuth 1.0a user credentials; advertiser/user verification.
- QuickBooks, Xero, PayPal and Square — provider-specific OAuth/API credentials and read-only account verification.
- GitHub, GitLab, Docker Hub and MongoDB Atlas — provider tokens/service credentials and authenticated account/organization verification.
- SurveyMonkey, SurveySparrow, Yotpo, MailerSend, Reply.io, Slack, Zoom and Rocket.Chat — provider-specific tokens/credentials and read-only identity/access verification.

### Wave 10

- **Exchange Rates** — uses an Open Exchange Rates App ID and verifies authenticated access to live FX data before the connection can become `connected`.
- **Mixpanel** — uses service-account username/secret, project ID and an allowlisted regional host; verification succeeds only when the service account can access the configured project.

These connectors may be configured through the Marketing Hub. The connection is returned as `connected` only after provider verification succeeds.

## Account connection versus ingestion

Some verified accounts already have governed Data Hub ingestion adapters. Others currently provide a real authenticated account connection but do not yet have a normalisation/extraction adapter.

For verified accounts without a Stage-5 ingestion adapter, the API reports:

`dataHubSourceStatus = account_connected_adapter_pending`

This is not a placeholder account connection: credentials have been validated against the provider. It explicitly means extraction/normalisation remains a separate implementation tranche.

## Deliberately non-connectable requested sources

The following requested names remain visible for inventory/roadmap coverage but do not expose a working Connect action because an honest end-to-end connector contract is not yet complete:

- **MySQL** — requires a real database driver plus host/port/database/username/password/TLS configuration and a successful authenticated database handshake/query. A network-socket probe is not sufficient.
- **Quora Ads** — requires a confirmed first-party advertiser account/reporting API and authentication contract. A conversion-event token is not treated as a substitute for a full Ads account connector.
- **Shopee Ads** — requires confirmed current partner/API eligibility and an authoritative advertiser/account verification flow.
- **Yahoo! Finance Price** — no first-party Yahoo Finance price-account API is represented as available. An unofficial scraper or third-party market-data API must not be presented as a Yahoo Finance account connector.

For these entries, `configurable=false`, no credential controls are exposed, and they cannot transition to `connected`.

## Credential handling

- Provider secrets are encrypted server-side and are never returned to the browser.
- Storing or rotating a secret sets verification state to `required`; it does not set `connected`.
- Successful provider verification sets `verificationStatus=verified`, `verifiedAt`, a bounded non-secret account summary and `status=connected`.
- Failed provider verification sets `verificationStatus=failed`, clears `connectedAt`, and leaves the connection `pending`.
- Disconnect revokes bound credential versions.
- Verification calls reject unsafe redirects and dynamic provider hosts are allowlisted where required.

## Production boundary

This tranche does not activate scheduled live provider sync, production deployments, provider-side writes, campaigns, mutations or background workers. Account verification calls are read-only and exist only to prove that the supplied credentials belong to an accessible provider account. No real user/provider credentials were supplied or exercised as part of the source-code implementation.