# Stage 8 — Marketing connections and Data Hub source provisioning

Authority: AIIBP Roadmap v2.9 Stage 8 and Issue #237.

## Purpose

Provide an AIIBP-owned Marketing workspace that collects the account identifiers and provider credentials required for governed marketing-data integrations, without copying third-party integration products or storing secrets in ordinary application metadata.

## Dashboard workspace

Route: `/marketing`

The canonical management navigation now exposes **Marketing** in the normal “Communicate and grow” area. The workspace groups providers by business task and uses progressive disclosure so managers do not face one large technical form.

Each provider card contains:
- provider description and official setup-documentation link;
- non-secret account identifiers;
- encrypted credential inputs;
- requested scopes;
- connection/readiness state;
- secure update and disconnect/revoke controls;
- Data Hub navigation.

## Provider coverage

### Advertising
- Google Ads
- Meta Ads
- LinkedIn Ads
- Microsoft Advertising
- TikTok Ads

### Organic social
- Facebook Pages
- Instagram Organic
- LinkedIn Pages
- YouTube Analytics

### Analytics and search
- Google Analytics 4
- Google Search Console

### Local and reputation
- Google Business Profile

### Commerce and payments
- Shopify
- Stripe

### CRM and marketing automation
- HubSpot
- Mailchimp

## Credential architecture

`IntegrationApp` + `IntegrationConnection` remain the connection authority. Secret values are written only through `providerCredentialService` and are represented by encrypted `CredentialVersion` records. The browser receives only stored/not-stored evidence; previously stored secret values are never returned.

Supported credential roles are reused rather than duplicated:
- `access_token`
- `refresh_token`
- `client_secret`
- `api_key`

Provider account IDs, property IDs, shop domains, organisation URNs and similar non-secret routing metadata remain on the tenant-owned connection record.

## Data Hub handoff

When a provider is fully configured, `marketingSourceProvisioningService` creates or updates a tenant-owned `MarketingDataSource` using the same IntegrationApp and IntegrationConnection. The source is created in:
- `status: ready`
- `syncMode: manual`
- `schedule.cadence: manual`
- `liveProviderExecution: false`

Disconnecting a provider pauses the corresponding managed source.

Marketing Connector Catalogue v2.0 adds normalized source contracts for the new providers. Initial normalized field families include:
- advertising: campaign, impressions, clicks, spend, conversions, revenue;
- organic social: content, impressions, reach, engagements, clicks;
- commerce/payment: orders/payments, revenue, refunds;
- CRM/email: campaigns, sends, opens, clicks, conversions;
- local profile: views, website clicks, calls and direction requests.

## Production boundary

This implementation does **not** activate:
- scheduled external-provider pulls;
- OAuth browser handshakes;
- token-refresh workers;
- new provider pagination executors;
- campaign write/budget-management operations;
- production backfills;
- production deployment.

The existing `marketingProviderRunService` remains the execution gate and continues to reject providers whose live adapter has not yet been accepted.

## Next provider-adapter work

Provider execution should be added one adapter at a time behind the existing source contract. For each provider, require:
1. least-privilege account/scopes;
2. controlled credential acceptance;
3. pagination and quota handling;
4. incremental checkpoint logic;
5. field mapping tests;
6. reconciliation counts;
7. connector health and retry evidence;
8. explicit production activation.

Recommended first execution order: Google Ads -> Meta Ads -> Shopify -> Stripe -> LinkedIn Ads -> Microsoft Ads -> TikTok Ads -> organic/social/CRM providers.
