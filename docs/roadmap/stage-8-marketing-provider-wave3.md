# Stage 8 Marketing Provider Wave 3

Status: source implementation complete; production activation intentionally gated.

## Scope

Wave 3 extends the governed Marketing/Data Hub provider layer with read-only reporting adapters for:

- LinkedIn Ads
- Microsoft Advertising
- TikTok Ads

All three adapters reuse the existing tenant-owned `IntegrationConnection`, encrypted provider credential authority, managed `MarketingDataSource`, canonical Data Hub run path, and the hard `liveProviderExecution` activation gate.

## LinkedIn Ads

- Uses versioned Marketing API `202610`.
- Reads `/rest/adAnalytics` with `q=statistics`, `CAMPAIGN` pivot and daily granularity.
- Sends `Linkedin-Version` and `X-Restli-Protocol-Version: 2.0.0`.
- Reads impressions, clicks, local spend, external website conversions and local conversion value.
- Pagination is bounded and restricted to HTTPS `api.linkedin.com/rest/adAnalytics` links.
- Requires the configured ad account and governed `access_token` credential.

## Microsoft Advertising

- Uses Reporting API v13.
- Uses the asynchronous `SubmitGenerateReport` → `PollGenerateReport` → report download workflow.
- Requests a daily `CampaignPerformanceReportRequest` containing campaign/date/currency/impressions/clicks/spend/conversions/revenue.
- OAuth refresh uses the current `https://ads.microsoft.com/msads.manage offline_access` scope.
- Developer token remains a governed `api_key` credential.
- Account ID and customer ID remain non-secret routing metadata.
- Poll count and downloaded ZIP size are bounded.
- The downloaded CSV is normalised into canonical campaign facts.

## TikTok Ads

- Uses Business API v2.0 synchronous reporting at `/report/integrated/get/`.
- Requests campaign/date dimensions with campaign name, spend, impressions, clicks, conversions and purchase value.
- Pagination and maximum records are bounded.
- Requires advertiser ID and governed `access_token` credential.

## Canonical output

All Wave 3 advertising adapters normalise into the same campaign reporting shape already used by Google Ads and Meta Ads:

- date
- campaignId
- campaignName
- impressions
- clicks
- spend
- conversions
- revenue

## Safety boundary

This implementation does not:

- create or edit campaigns;
- mutate budgets or bids;
- publish creatives;
- activate scheduled provider pulls;
- perform a production OAuth handshake;
- backfill production data;
- deploy to production.

Sources created from the Marketing dashboard remain `ready/manual` with `liveProviderExecution:false` until an explicitly controlled activation step changes that state.
