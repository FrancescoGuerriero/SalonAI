export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE9 = Object.freeze({
  microsoft_clarity: Object.freeze({
    key: "microsoft_clarity",
    label: "Microsoft Clarity",
    category: "Analytics & search",
    description: "Connect a Microsoft Clarity project using its Data Export API token and verify read access to live project insights.",
    documentationUrl: "https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api",
    fields: [],
    credentials: [
      { key: "accessToken", label: "Clarity Data Export API token", role: "access_token", required: true, secret: true },
    ],
    scopes: ["project-live-insights:read"],
  }),
  mntn: Object.freeze({
    key: "mntn",
    label: "MNTN (mountain.com)",
    category: "Advertising",
    description: "Connect MNTN Reporting API 3.0 using the account Reporting API key and verify reporting metadata access.",
    documentationUrl: "https://help.mountain.com/en/articles/9106215-upgrade-to-api-3-0",
    fields: [],
    credentials: [
      { key: "apiKey", label: "MNTN Reporting API key", role: "api_key", required: true, secret: true },
    ],
    scopes: ["reporting:read"],
  }),
  gravity_forms: Object.freeze({
    key: "gravity_forms",
    label: "Gravity Forms",
    category: "CRM & automation",
    description: "Connect a self-hosted Gravity Forms REST API v2 installation over HTTPS and verify read access to forms using REST API credentials.",
    documentationUrl: "https://docs.gravityforms.com/rest-api-v2-authentication/",
    fields: [
      { key: "siteUrl", label: "WordPress site URL", required: true, secret: false, placeholder: "https://www.example.com" },
      { key: "consumerKey", label: "Gravity Forms consumer key", required: true, secret: false, placeholder: "ck_..." },
    ],
    credentials: [
      { key: "consumerSecret", label: "Gravity Forms consumer secret", role: "consumer_secret", required: true, secret: true },
    ],
    scopes: ["gravityforms_edit_forms"],
  }),
  mongodb: Object.freeze({
    key: "mongodb",
    label: "MongoDB Atlas",
    category: "Data & warehouse",
    description: "Connect MongoDB Atlas using a Service Account OAuth2 client ID and secret, then verify Atlas organization access through the Admin API v2.",
    documentationUrl: "https://www.mongodb.com/docs/api/doc/atlas-admin-api-v2",
    fields: [
      { key: "clientId", label: "Atlas Service Account client ID", required: true, secret: false, placeholder: "mdb_sa_id_..." },
    ],
    credentials: [
      { key: "clientSecret", label: "Atlas Service Account client secret", role: "client_secret", required: true, secret: true },
      { key: "accessToken", label: "Atlas access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["atlas-admin:read"],
  }),
  yahoo_japan: Object.freeze({
    key: "yahoo_japan",
    label: "LY Ads (Yahoo! Japan)",
    category: "Advertising",
    description: "Connect LY Ads using Business ID OAuth2 credentials and verify the accounts directly accessible to the authorised Business ID with Search Ads API v20 BaseAccountService.",
    documentationUrl: "https://ads-developers.yahoo.co.jp/en/ads-api/startup-guide/api-call.html",
    fields: [
      { key: "clientId", label: "LY Ads application client ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "clientSecret", label: "LY Ads application client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "LY Ads refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "LY Ads access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["yahooads"],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE9;