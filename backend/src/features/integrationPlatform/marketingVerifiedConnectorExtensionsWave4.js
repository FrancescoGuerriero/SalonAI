export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4 = Object.freeze({
  amazon_ads: Object.freeze({
    key: "amazon_ads",
    label: "Amazon Ads",
    category: "Advertising",
    description: "Connect Amazon Ads using Login with Amazon OAuth credentials and verify accessible advertising profiles.",
    documentationUrl: "https://advertising.amazon.com/API/docs/en-us/guides/account-management/authorization/authorization-grants",
    fields: [
      { key: "clientId", label: "Login with Amazon client ID", required: true, secret: false, placeholder: "amzn1.application-oa2-client..." },
      { key: "region", label: "Amazon Ads region", required: true, secret: false, placeholder: "EU", help: "Use NA, EU or FE." },
    ],
    credentials: [
      { key: "clientSecret", label: "Login with Amazon client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Amazon Ads refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "Amazon Ads access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["advertising::campaign_management"],
  }),
  amazon_dsp: Object.freeze({
    key: "amazon_dsp",
    label: "Amazon DSP",
    category: "Advertising",
    description: "Connect an Amazon Ads/DSP account using Login with Amazon OAuth and verify the advertiser profiles available to the user.",
    documentationUrl: "https://advertising.amazon.com/API/docs/en-us/guides/reporting/dsp/creating-reports",
    fields: [
      { key: "clientId", label: "Login with Amazon client ID", required: true, secret: false, placeholder: "amzn1.application-oa2-client..." },
      { key: "region", label: "Amazon Ads region", required: true, secret: false, placeholder: "EU", help: "Use NA, EU or FE." },
    ],
    credentials: [
      { key: "clientSecret", label: "Login with Amazon client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Amazon Ads refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "Amazon Ads access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["advertising::campaign_management"],
  }),
  amazon_seller_central: Object.freeze({
    key: "amazon_seller_central",
    label: "Amazon Seller Central (Amazon SP)",
    category: "Marketplace & commerce",
    description: "Connect Amazon Seller Central through SP-API using Login with Amazon credentials and verify marketplace participation.",
    documentationUrl: "https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api",
    fields: [
      { key: "clientId", label: "LWA client ID", required: true, secret: false, placeholder: "amzn1.application-oa2-client..." },
      { key: "region", label: "SP-API region", required: true, secret: false, placeholder: "EU", help: "Use NA, EU or FE." },
    ],
    credentials: [
      { key: "clientSecret", label: "LWA client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Selling Partner refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "LWA access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["sellingpartnerapi"],
  }),
  amazon_vendor_central: Object.freeze({
    key: "amazon_vendor_central",
    label: "Amazon Vendor Central",
    category: "Marketplace & commerce",
    description: "Connect Amazon Vendor Central through SP-API using Login with Amazon credentials and verify Vendor Orders API access.",
    documentationUrl: "https://developer-docs.amazon.com/sp-api/docs/onboarding-overview",
    fields: [
      { key: "clientId", label: "LWA client ID", required: true, secret: false, placeholder: "amzn1.application-oa2-client..." },
      { key: "region", label: "SP-API region", required: true, secret: false, placeholder: "EU", help: "Use NA, EU or FE." },
    ],
    credentials: [
      { key: "clientSecret", label: "LWA client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Vendor authorization refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "LWA access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["sellingpartnerapi"],
  }),
  amazon_sqs: Object.freeze({
    key: "amazon_sqs",
    label: "Amazon SQS",
    category: "Data & developer infrastructure",
    description: "Connect Amazon SQS with AWS access credentials and verify read access using a SigV4-signed ListQueues request.",
    documentationUrl: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ListQueues.html",
    fields: [
      { key: "accessKeyId", label: "AWS access key ID", required: true, secret: false, placeholder: "AKIA..." },
      { key: "region", label: "AWS region", required: true, secret: false, placeholder: "eu-west-2" },
    ],
    credentials: [
      { key: "secretAccessKey", label: "AWS secret access key", role: "secret_access_key", required: true, secret: true },
      { key: "sessionToken", label: "AWS session token", role: "session_token", required: false, secret: true },
    ],
    scopes: ["sqs:ListQueues"],
  }),
  apple_search_ads: Object.freeze({
    key: "apple_search_ads",
    label: "Apple Search Ads",
    category: "Advertising",
    description: "Connect Apple Ads Platform using OAuth2 client credentials backed by an ES256 private key and verify the API user with GET /v1/me.",
    documentationUrl: "https://developer.apple.com/documentation/apple-ads-platform-api/implementing-oauth-for-the-apple-ads-platform-api",
    fields: [
      { key: "clientId", label: "Apple Ads client ID", required: true, secret: false, placeholder: "SEARCHADS..." },
      { key: "teamId", label: "Apple Ads team ID", required: true, secret: false, placeholder: "SEARCHADS..." },
      { key: "keyId", label: "Apple Ads key ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "privateKey", label: "Apple Ads EC private key (PEM)", role: "private_key", required: true, secret: true },
      { key: "accessToken", label: "Apple Ads access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["searchadsorg"],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4;