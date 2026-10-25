# Stage 8 Marketing Provider Wave 5

Status: source implementation complete; production activation intentionally gated.

## Scope

Wave 5 closes the remaining first-party Marketing/Data Hub provider gaps with read-only adapters for:

- Google Business Profile performance
- HubSpot Marketing Email performance
- Mailchimp campaign reports

It also exposes Bing Webmaster Tools in the Marketing connection catalogue so every provider already supported by the Stage 8/Stage 5 Data Hub has a dashboard connection workflow.

## Google Business Profile

- Uses Business Profile Performance API v1.
- Reads `locations/*:fetchMultiDailyMetricsTimeSeries`.
- Uses `business.manage` OAuth scope and the existing encrypted Google credential refresh path.
- Aggregates Search/Maps desktop/mobile impression metrics into canonical `views` evidence.
- Reads website clicks, call clicks and direction requests.
- Does not modify Business Profile content or settings.

## HubSpot

- Uses the stable v3 Marketing Email collection with `includeStats=true`.
- Reads campaign/email metadata and statistics through bearer authentication.
- Normalises campaign ID/name, sends, opens, clicks and conversions into the existing CRM Data Hub contract.
- Cursor pagination is bounded and cursor input is constrained.
- The Marketing connection and connector catalogue include HubSpot `content` access in addition to existing CRM read scopes because Marketing Email v3 is a content API surface.
- No marketing-email creation, update, publishing or sending endpoints are implemented.

## Mailchimp

- Uses the Marketing API `GET /3.0/reports` endpoint.
- Validates the configured data-centre prefix before constructing the API origin.
- Reads sent-campaign reports with bounded offset pagination and date filters.
- Normalises emails sent, unique opens, unique clicks and ecommerce total orders.
- No campaign/audience mutation endpoints are implemented.

## Bing Webmaster connection completion

The Stage 5 Bing Webmaster adapter/source contract already existed, but Stage 8 Marketing did not expose a connection form. Wave 5 adds:

- Microsoft OAuth client ID
- site URL
- encrypted client secret
- encrypted refresh token
- optional short-lived access token
- optional legacy API-key compatibility field

Configured Bing sources still inherit `ready/manual` and `liveProviderExecution:false` from managed source provisioning.

## Safety boundary

All Wave 5 providers remain behind the existing hard provider-execution lock. This implementation does not:

- activate live provider retrieval;
- run production OAuth handshakes;
- schedule provider pulls;
- perform historical backfills;
- mutate external campaigns, emails, audiences, profiles or settings;
- deploy to production.

The implementation is source-ready for controlled provider acceptance and activation only after credentials, permissions, data mapping and operational evidence are reviewed.
