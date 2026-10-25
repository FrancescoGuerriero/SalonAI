export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS = Object.freeze({
  pinterest_ads: Object.freeze({
    key: "pinterest_ads",
    label: "Pinterest Ads",
    category: "Advertising",
    description: "Connect Pinterest with an OAuth access token and verify the authenticated Pinterest account through API v5.",
    documentationUrl: "https://developers.pinterest.com/docs/api/v5/user_account-get/",
    fields: [],
    credentials: [
      { key: "accessToken", label: "Pinterest OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "Pinterest OAuth refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["user_accounts:read", "ads:read"],
  }),
  pinterest_organic: Object.freeze({
    key: "pinterest_organic",
    label: "Pinterest Organic",
    category: "Organic social",
    description: "Connect Pinterest with an OAuth access token and verify the authenticated Pinterest account through API v5.",
    documentationUrl: "https://developers.pinterest.com/docs/api/v5/user_account-get/",
    fields: [],
    credentials: [
      { key: "accessToken", label: "Pinterest OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "Pinterest OAuth refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["user_accounts:read", "boards:read", "pins:read"],
  }),
  slack: Object.freeze({
    key: "slack",
    label: "Slack",
    category: "Communications & collaboration",
    description: "Connect a Slack workspace with an OAuth token and verify the token/workspace identity with auth.test.",
    documentationUrl: "https://docs.slack.dev/reference/methods/auth.test",
    fields: [],
    credentials: [
      { key: "accessToken", label: "Slack OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "Slack refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: [],
  }),
  zoom: Object.freeze({
    key: "zoom",
    label: "Zoom",
    category: "Communications & collaboration",
    description: "Connect a Zoom Server-to-Server OAuth app using account ID, client ID and client secret, then verify the account with the Users API.",
    documentationUrl: "https://developers.zoom.us/docs/integrations/oauth/",
    fields: [
      { key: "accountId", label: "Zoom account ID", required: true, secret: false, placeholder: "" },
      { key: "clientId", label: "Zoom client ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "clientSecret", label: "Zoom client secret", role: "client_secret", required: true, secret: true },
    ],
    scopes: ["user:read:user:admin"],
  }),
  spotify_ads: Object.freeze({
    key: "spotify_ads",
    label: "Spotify Ads",
    category: "Advertising",
    description: "Connect Spotify Ads Manager through OAuth 2.0 and verify accessible businesses using Ads API v3.",
    documentationUrl: "https://developer.spotify.com/documentation/ads-api/quick-start",
    fields: [
      { key: "clientId", label: "Spotify client ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "clientSecret", label: "Spotify client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Spotify Ads refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "Spotify Ads access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["ads"],
  }),
  salesforce: Object.freeze({
    key: "salesforce",
    label: "Salesforce",
    category: "CRM & automation",
    description: "Connect Salesforce using an OAuth access token and instance URL and verify the authenticated Salesforce user through OAuth userinfo.",
    documentationUrl: "https://developer.salesforce.com/docs/platform/headless-identity-impl-guide/guide/headless-identity-postman-getuserinfo.html",
    fields: [
      { key: "instanceUrl", label: "Salesforce instance URL", required: true, secret: false, placeholder: "https://your-domain.my.salesforce.com" },
    ],
    credentials: [
      { key: "accessToken", label: "Salesforce OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "Salesforce OAuth refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["api", "openid", "refresh_token"],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS;