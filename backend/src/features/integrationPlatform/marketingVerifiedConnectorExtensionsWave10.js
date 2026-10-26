export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE10 = Object.freeze({
  exchange_rates: Object.freeze({
    key: "exchange_rates",
    label: "Exchange Rates",
    category: "Finance & payments",
    description: "Connect Open Exchange Rates using a real account App ID and verify authenticated access to current FX rates.",
    documentationUrl: "https://docs.openexchangerates.org/reference/authentication",
    fields: [],
    credentials: [
      {
        key: "appId",
        label: "Open Exchange Rates App ID",
        role: "api_key",
        required: true,
        secret: true,
        help: "Create or copy the App ID from your Open Exchange Rates account dashboard.",
      },
    ],
    scopes: ["rates:read"],
  }),
  mixpanel: Object.freeze({
    key: "mixpanel",
    label: "Mixpanel",
    category: "Analytics & search",
    description: "Connect Mixpanel with a service account and project ID, then verify the service account can access the configured project.",
    documentationUrl: "https://developer.mixpanel.com/reference/service-accounts-api",
    fields: [
      {
        key: "serviceAccountUsername",
        label: "Mixpanel service-account username",
        required: true,
        secret: false,
        placeholder: "service-account-name",
      },
      {
        key: "projectId",
        label: "Mixpanel project ID",
        required: true,
        secret: false,
        placeholder: "1234567",
      },
      {
        key: "region",
        label: "Mixpanel data region",
        required: true,
        secret: false,
        placeholder: "US",
        help: "Use US, EU or IN so verification is sent only to Mixpanel's approved regional API host.",
      },
    ],
    credentials: [
      {
        key: "serviceAccountSecret",
        label: "Mixpanel service-account secret",
        role: "password",
        required: true,
        secret: true,
      },
    ],
    scopes: ["query:read"],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE10;
