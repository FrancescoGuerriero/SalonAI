export const PROVIDER_AUTH_MODES = Object.freeze({
  OAUTH: "oauth",
  API_CREDENTIALS: "api-credentials",
  HYBRID: "hybrid",
});

function provider(definition) {
  return Object.freeze({
    priority: "standard",
    scopes: Object.freeze([]),
    credentialFields: Object.freeze([]),
    ...definition,
    scopes: Object.freeze(definition.scopes || []),
    credentialFields: Object.freeze(definition.credentialFields || []),
  });
}

export const PROVIDER_CONNECTIONS = Object.freeze([
  provider({ key: "google_ads", label: "Google Ads", category: "Advertising", authMode: "oauth", priority: "p0", modules: ["marketing"], scopes: ["campaign reporting", "spend", "clicks", "conversions"] }),
  provider({ key: "facebook", label: "Meta Ads", category: "Advertising", authMode: "oauth", priority: "p0", modules: ["marketing"], scopes: ["campaign reporting", "spend", "conversions", "account insights"] }),
  provider({ key: "microsoft_ads", label: "Microsoft Advertising", category: "Advertising", authMode: "oauth", priority: "p0", modules: ["marketing"], scopes: ["campaign reporting", "spend", "clicks", "conversions"] }),
  provider({ key: "apple_search_ads", label: "Apple Ads", category: "Advertising", authMode: "oauth", priority: "conditional", modules: ["marketing"], scopes: ["campaign reporting", "App Store/Maps advertising"] }),
  provider({ key: "ga4", label: "Google Analytics 4", category: "Analytics & measurement", authMode: "oauth", priority: "p0", modules: ["marketing", "analytics"], scopes: ["analytics reporting", "ecommerce", "conversion evidence"] }),
  provider({ key: "google_tag_manager", label: "Google Tag Manager", category: "Analytics & measurement", authMode: "oauth", priority: "p0", modules: ["marketing", "integrations"], scopes: ["containers", "tags", "triggers", "variables"] }),
  provider({ key: "google_search_console", label: "Google Search Console", category: "Analytics & measurement", authMode: "oauth", priority: "p0", modules: ["marketing", "analytics"], scopes: ["search performance", "queries", "pages"] }),
  provider({ key: "bing_webmaster", label: "Bing Webmaster Tools", category: "Analytics & measurement", authMode: "oauth", priority: "p0", modules: ["marketing", "analytics"], scopes: ["search performance", "crawl evidence", "keywords"] }),
  provider({ key: "sendgrid", label: "Twilio SendGrid", category: "Communications", authMode: "api-credentials", priority: "p0", modules: ["communications", "marketing"], credentialFields: ["apiKey"], scopes: ["transactional email", "marketing email", "delivery analytics"] }),
  provider({ key: "twilio", label: "Twilio Messaging", category: "Communications", authMode: "api-credentials", priority: "p0", modules: ["communications", "marketing", "ai-receptionist"], credentialFields: ["accountSid", "authToken"], scopes: ["SMS", "WhatsApp", "delivery status"] }),
  provider({ key: "amazon_sp", label: "Amazon Seller Central", category: "Marketplaces", authMode: "oauth", priority: "p0", modules: ["seller-marketplace"], scopes: ["orders", "catalogue", "inventory", "seller performance"] }),
  provider({ key: "ebay", label: "eBay", category: "Marketplaces", authMode: "oauth", priority: "p0", modules: ["seller-marketplace"], scopes: ["listings", "orders", "inventory", "seller analytics"] }),
  provider({ key: "google_merchant_center", label: "Google Merchant Center", category: "Marketplaces", authMode: "oauth", priority: "p0", modules: ["seller-marketplace", "ecommerce-store"], scopes: ["products", "inventory", "promotions", "performance"] }),
  provider({ key: "quickbooks", label: "QuickBooks", category: "Accounting", authMode: "oauth", priority: "planned", modules: ["integrations"], scopes: ["customers", "invoices", "payments", "accounting reports"] }),
  provider({ key: "xero", label: "Xero", category: "Accounting", authMode: "oauth", priority: "planned", modules: ["integrations"], scopes: ["contacts", "invoices", "payments", "accounting reports"] }),
  provider({ key: "stripe", label: "Stripe", category: "Payments", authMode: "api-credentials", priority: "standard", modules: ["commerce"], credentialFields: ["publishableKey", "secretKey"], scopes: ["payments", "refunds", "reconciliation"] }),
]);

export const PROVIDER_CONNECTION_CATEGORIES = Object.freeze([
  ...new Set(PROVIDER_CONNECTIONS.map(({ category }) => category)),
]);

export function providersForModule(moduleKey) {
  return PROVIDER_CONNECTIONS.filter(({ modules }) => modules.includes(moduleKey));
}

export function providerConnectionDefinition(key) {
  return PROVIDER_CONNECTIONS.find((item) => item.key === key) || null;
}
