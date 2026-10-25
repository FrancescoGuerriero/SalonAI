# Stage 8 Marketing Provider Wave 4

Status: source implementation complete; production activation intentionally gated.

## Scope

Wave 4 adds read-only organic/social analytics adapters for:

- Facebook Pages
- Instagram Organic
- LinkedIn Pages
- YouTube Analytics

All adapters reuse tenant-owned IntegrationConnection credentials, managed MarketingDataSource records, canonical Data Hub execution and the hard `liveProviderExecution` gate.

## Facebook Pages

- Uses Meta Graph API v26.0 Page Insights.
- Reads daily Page media-view, post-engagement and Page-view evidence.
- Uses bearer access-token authentication.
- Paging URLs are restricted to HTTPS `graph.facebook.com` and the expected Page Insights path.
- No Page posts, comments or profile data are mutated.

## Instagram Organic

- Uses Meta Graph API v26.0 account Insights for a configured professional account.
- Reads current views, reach and total-interaction evidence.
- Uses bearer access-token authentication.
- No publishing or media mutation endpoints are implemented.

## LinkedIn Pages

- Uses versioned LinkedIn Marketing API `202610`.
- Reads daily `organizationPageStatistics` for configured organization URNs.
- Sends `Linkedin-Version` and `X-Restli-Protocol-Version: 2.0.0`.
- Normalises Page views and clicks into the social Data Hub contract.
- Current LinkedIn documentation requires `rw_organization_admin` for organization Page reporting; connection-scope reconciliation is a controlled credential/authorization prerequisite before live activation.

## YouTube Analytics

- Uses `GET https://youtubeanalytics.googleapis.com/v2/reports`.
- Uses channel ID, start/end dates, `day` dimension and read-only activity metrics.
- Reads views, likes, comments, shares, watch-time and subscriber movement while normalising the existing social contract.
- Uses Google OAuth credential refresh through the encrypted provider credential authority.
- Current API documentation notes `youtube.readonly` for reports.query; OAuth scope reconciliation is required before live activation where an older token only carries `yt-analytics.readonly`.

## Canonical social output

Wave 4 records use the existing Stage 8 social contract:

- date
- contentId
- contentType
- impressions/views evidence
- reach
- engagements
- clicks

Provider-native measures that do not have an exact canonical field are not used to create a second source of truth.

## Safety boundary

This implementation does not:

- publish or edit social content;
- modify profiles or Pages;
- activate scheduled provider pulls;
- perform production OAuth handshakes;
- backfill production data;
- deploy to production.

Marketing-dashboard sources remain `ready/manual` with `liveProviderExecution:false` until explicit controlled activation and provider acceptance are completed.
