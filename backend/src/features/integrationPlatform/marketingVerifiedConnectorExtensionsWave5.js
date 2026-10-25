function googleOAuthCredentials() {
  return [
    { key: "clientSecret", label: "Google OAuth client secret", role: "client_secret", required: true, secret: true },
    { key: "refreshToken", label: "Google OAuth refresh token", role: "refresh_token", required: true, secret: true },
    { key: "accessToken", label: "Google OAuth access token", role: "access_token", required: false, secret: true },
  ];
}

function clientIdField() {
  return { key: "clientId", label: "Google OAuth client ID", required: true, secret: false, placeholder: "...apps.googleusercontent.com" };
}

export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5 = Object.freeze({
  google_ad_manager: Object.freeze({
    key: "google_ad_manager",
    label: "Google Ad Manager",
    category: "Advertising",
    description: "Connect Google Ad Manager with OAuth and verify accessible networks using the Ad Manager REST API v1.",
    documentationUrl: "https://developers.google.com/ad-manager/api/beta/reference/rest/v1/networks/list",
    fields: [clientIdField()],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/dfp"],
  }),
  google_bigquery: Object.freeze({
    key: "google_bigquery",
    label: "Google BigQuery",
    category: "Data & warehouse",
    description: "Connect Google BigQuery with OAuth and verify dataset metadata access for the configured Google Cloud project.",
    documentationUrl: "https://cloud.google.com/bigquery/docs/reference/rest/v2/datasets/list",
    fields: [
      clientIdField(),
      { key: "projectId", label: "Google Cloud project ID", required: true, secret: false, placeholder: "my-project" },
    ],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/bigquery.readonly"],
  }),
  google_campaign_manager_360: Object.freeze({
    key: "google_campaign_manager_360",
    label: "Google Campaign Manager 360 (CM360)",
    category: "Advertising",
    description: "Connect Campaign Manager 360 with OAuth and verify accessible DFA user profiles using Reporting API v5.",
    documentationUrl: "https://developers.google.com/doubleclick-advertisers/rest/v5/userProfiles/list",
    fields: [clientIdField()],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/dfareporting"],
  }),
  google_display_video_360: Object.freeze({
    key: "google_display_video_360",
    label: "Google Display & Video 360 (DV360)",
    category: "Advertising",
    description: "Connect Display & Video 360 with OAuth and verify advertiser access under the configured partner using stable API v4.",
    documentationUrl: "https://developers.google.com/display-video/api/reference/rest/v4/advertisers/list",
    fields: [
      clientIdField(),
      { key: "partnerId", label: "DV360 partner ID", required: true, secret: false, placeholder: "123456789" },
    ],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/display-video"],
  }),
  google_merchant_center: Object.freeze({
    key: "google_merchant_center",
    label: "Google Merchant Center",
    category: "Marketplace & commerce",
    description: "Connect Merchant Center with OAuth and verify accessible merchant accounts using Merchant API Accounts v1.",
    documentationUrl: "https://developers.google.com/merchant/api/reference/rest/accounts_v1/accounts/list",
    fields: [clientIdField()],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/content"],
  }),
  google_search_ads_360: Object.freeze({
    key: "google_search_ads_360",
    label: "Google Search Ads 360 (SA360)",
    category: "Advertising",
    description: "Connect Search Ads 360 with OAuth and verify access to the configured customer using the Reporting API v0.",
    documentationUrl: "https://developers.google.com/search-ads/reporting/api/reference/rest/v0/customers.searchAds360/search",
    fields: [
      clientIdField(),
      { key: "customerId", label: "SA360 customer ID", required: true, secret: false, placeholder: "1234567890" },
    ],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/doubleclicksearch"],
  }),
  google_sheets: Object.freeze({
    key: "google_sheets",
    label: "Google Sheets",
    category: "Data & warehouse",
    description: "Connect Google Sheets with OAuth and verify read access to the configured spreadsheet using Sheets API v4.",
    documentationUrl: "https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get",
    fields: [
      clientIdField(),
      { key: "spreadsheetId", label: "Spreadsheet ID", required: true, secret: false, placeholder: "1AbC..." },
    ],
    credentials: googleOAuthCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  }),
  google_pagespeed_insights: Object.freeze({
    key: "google_pagespeed_insights",
    label: "Google PageSpeed Insights",
    category: "Analytics & search",
    description: "Connect PageSpeed Insights with a Google API key and verify the configured public page through the PageSpeed Insights API.",
    documentationUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    fields: [
      { key: "pageUrl", label: "Page URL", required: true, secret: false, placeholder: "https://example.com" },
    ],
    credentials: [
      { key: "apiKey", label: "Google API key", role: "api_key", required: true, secret: true },
    ],
    scopes: [],
  }),
  google_webfonts: Object.freeze({
    key: "google_webfonts",
    label: "Google Webfonts",
    category: "Web & content",
    description: "Connect Google Web Fonts Developer API with a Google API key and verify catalogue access.",
    documentationUrl: "https://developers.google.com/fonts/docs/developer_api",
    fields: [],
    credentials: [
      { key: "apiKey", label: "Google API key", role: "api_key", required: true, secret: true },
    ],
    scopes: [],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5;