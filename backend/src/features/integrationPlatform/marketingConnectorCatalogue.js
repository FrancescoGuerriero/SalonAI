export const MARKETING_CONNECTOR_CATALOGUE_VERSION = "2.0.0";

function definition(value) {
  return Object.freeze({
    ...value,
    schemaVersion: value.schemaVersion || "1.0.0",
    requiredScopes: Object.freeze([...(value.requiredScopes || [])]),
    checkpointStrategies: Object.freeze([...(value.checkpointStrategies || [])]),
    defaultFields: Object.freeze((value.defaultFields || []).map((field) => Object.freeze({ ...field }))),
  });
}

const dateField = Object.freeze({ sourceField: "date", dataType: "date", role: "timestamp", normalisedField: "occurredAt", required: true });
const adFields = Object.freeze([
  dateField,
  { sourceField: "campaignId", dataType: "string", role: "identifier", normalisedField: "campaignId" },
  { sourceField: "campaignName", dataType: "string", role: "dimension", normalisedField: "campaign" },
  { sourceField: "impressions", dataType: "number", role: "metric", normalisedField: "impressions" },
  { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
  { sourceField: "spend", dataType: "number", role: "metric", normalisedField: "spend" },
  { sourceField: "conversions", dataType: "number", role: "metric", normalisedField: "conversions" },
  { sourceField: "revenue", dataType: "number", role: "metric", normalisedField: "revenue" },
]);
const socialFields = Object.freeze([
  dateField,
  { sourceField: "contentId", dataType: "string", role: "identifier", normalisedField: "contentId" },
  { sourceField: "contentType", dataType: "string", role: "dimension", normalisedField: "contentType" },
  { sourceField: "impressions", dataType: "number", role: "metric", normalisedField: "impressions" },
  { sourceField: "reach", dataType: "number", role: "metric", normalisedField: "reach" },
  { sourceField: "engagements", dataType: "number", role: "metric", normalisedField: "engagements" },
  { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
]);
const commerceFields = Object.freeze([
  dateField,
  { sourceField: "orderId", dataType: "string", role: "identifier", normalisedField: "orderId" },
  { sourceField: "channel", dataType: "string", role: "dimension", normalisedField: "channel" },
  { sourceField: "orders", dataType: "number", role: "metric", normalisedField: "orders" },
  { sourceField: "revenue", dataType: "number", role: "metric", normalisedField: "revenue" },
  { sourceField: "refunds", dataType: "number", role: "metric", normalisedField: "refunds" },
]);
const crmFields = Object.freeze([
  dateField,
  { sourceField: "campaignId", dataType: "string", role: "identifier", normalisedField: "campaignId" },
  { sourceField: "campaignName", dataType: "string", role: "dimension", normalisedField: "campaign" },
  { sourceField: "sends", dataType: "number", role: "metric", normalisedField: "sends" },
  { sourceField: "opens", dataType: "number", role: "metric", normalisedField: "opens" },
  { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
  { sourceField: "conversions", dataType: "number", role: "metric", normalisedField: "conversions" },
]);

function adapterDefinition({ key, label, fields, scopes = [] }) {
  return definition({
    key,
    label,
    entityType: "generic_record",
    liveActivation: "adapter_pending_acceptance",
    requiredScopes: scopes,
    checkpointStrategies: ["date_watermark", "cursor", "manual"],
    defaultFields: fields,
  });
}

const CONNECTORS = Object.freeze({
  ga4: definition({
    key: "ga4",
    label: "Google Analytics 4",
    entityType: "analytics_event",
    liveActivation: "oauth",
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    checkpointStrategies: ["date_watermark"],
    defaultFields: [
      dateField,
      { sourceField: "eventName", dataType: "string", role: "dimension", normalisedField: "eventName" },
      { sourceField: "sessions", dataType: "number", role: "metric", normalisedField: "sessions" },
      { sourceField: "activeUsers", dataType: "number", role: "metric", normalisedField: "activeUsers" },
      { sourceField: "conversions", dataType: "number", role: "metric", normalisedField: "conversions" },
    ],
  }),
  google_search_console: definition({
    key: "google_search_console",
    label: "Google Search Console",
    entityType: "search_performance",
    liveActivation: "oauth",
    requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    checkpointStrategies: ["date_watermark"],
    defaultFields: [
      dateField,
      { sourceField: "query", dataType: "string", role: "dimension", normalisedField: "query" },
      { sourceField: "page", dataType: "string", role: "dimension", normalisedField: "page" },
      { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
      { sourceField: "impressions", dataType: "number", role: "metric", normalisedField: "impressions" },
      { sourceField: "ctr", dataType: "number", role: "metric", normalisedField: "ctr" },
      { sourceField: "position", dataType: "number", role: "metric", normalisedField: "position" },
    ],
  }),
  bing_webmaster: definition({
    key: "bing_webmaster",
    label: "Bing Webmaster Tools",
    entityType: "search_performance",
    liveActivation: "provider_credential",
    requiredScopes: ["webmaster.read"],
    checkpointStrategies: ["date_watermark"],
    defaultFields: [
      dateField,
      { sourceField: "query", dataType: "string", role: "dimension", normalisedField: "query" },
      { sourceField: "url", dataType: "string", role: "dimension", normalisedField: "page" },
      { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
      { sourceField: "impressions", dataType: "number", role: "metric", normalisedField: "impressions" },
      { sourceField: "averagePosition", dataType: "number", role: "metric", normalisedField: "position" },
    ],
  }),
  google_ads: adapterDefinition({ key: "google_ads", label: "Google Ads", fields: adFields, scopes: ["https://www.googleapis.com/auth/adwords"] }),
  meta_ads: adapterDefinition({ key: "meta_ads", label: "Meta Ads", fields: adFields, scopes: ["ads_read", "read_insights"] }),
  linkedin_ads: adapterDefinition({ key: "linkedin_ads", label: "LinkedIn Ads", fields: adFields, scopes: ["r_ads", "r_ads_reporting"] }),
  microsoft_ads: adapterDefinition({ key: "microsoft_ads", label: "Microsoft Advertising", fields: adFields, scopes: ["https://ads.microsoft.com/msads.manage"] }),
  tiktok_ads: adapterDefinition({ key: "tiktok_ads", label: "TikTok Ads", fields: adFields, scopes: ["reporting"] }),
  facebook_pages: adapterDefinition({ key: "facebook_pages", label: "Facebook Pages", fields: socialFields, scopes: ["pages_read_engagement", "read_insights"] }),
  instagram_organic: adapterDefinition({ key: "instagram_organic", label: "Instagram Organic", fields: socialFields, scopes: ["instagram_basic", "instagram_manage_insights"] }),
  linkedin_pages: adapterDefinition({ key: "linkedin_pages", label: "LinkedIn Pages", fields: socialFields, scopes: ["r_organization_social"] }),
  google_business_profile: adapterDefinition({
    key: "google_business_profile",
    label: "Google Business Profile",
    fields: [
      dateField,
      { sourceField: "locationId", dataType: "string", role: "identifier", normalisedField: "locationId" },
      { sourceField: "locationName", dataType: "string", role: "dimension", normalisedField: "location" },
      { sourceField: "views", dataType: "number", role: "metric", normalisedField: "impressions" },
      { sourceField: "websiteClicks", dataType: "number", role: "metric", normalisedField: "clicks" },
      { sourceField: "calls", dataType: "number", role: "metric", normalisedField: "calls" },
      { sourceField: "directionRequests", dataType: "number", role: "metric", normalisedField: "directionRequests" },
    ],
    scopes: ["https://www.googleapis.com/auth/business.manage"],
  }),
  shopify: adapterDefinition({ key: "shopify", label: "Shopify", fields: commerceFields, scopes: ["read_orders", "read_products", "read_customers"] }),
  stripe: adapterDefinition({
    key: "stripe",
    label: "Stripe",
    fields: [
      dateField,
      { sourceField: "paymentId", dataType: "string", role: "identifier", normalisedField: "paymentId" },
      { sourceField: "currency", dataType: "string", role: "dimension", normalisedField: "currency" },
      { sourceField: "payments", dataType: "number", role: "metric", normalisedField: "orders" },
      { sourceField: "revenue", dataType: "number", role: "metric", normalisedField: "revenue" },
      { sourceField: "refunds", dataType: "number", role: "metric", normalisedField: "refunds" },
    ],
    scopes: ["payments:read"],
  }),
  hubspot: adapterDefinition({ key: "hubspot", label: "HubSpot", fields: crmFields, scopes: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"] }),
  mailchimp: adapterDefinition({ key: "mailchimp", label: "Mailchimp", fields: crmFields, scopes: ["marketing:read"] }),
  youtube_analytics: adapterDefinition({ key: "youtube_analytics", label: "YouTube Analytics", fields: socialFields, scopes: ["https://www.googleapis.com/auth/yt-analytics.readonly"] }),
  generic: definition({
    key: "generic",
    label: "Generic structured source",
    entityType: "generic_record",
    liveActivation: "adapter",
    requiredScopes: [],
    checkpointStrategies: ["cursor", "date_watermark", "manual"],
    defaultFields: [],
  }),
  technical_seo: definition({
    key: "technical_seo",
    label: "Technical SEO crawler",
    entityType: "seo_page",
    liveActivation: "none",
    requiredScopes: [],
    checkpointStrategies: ["manual", "date_watermark"],
    defaultFields: [
      { sourceField: "url", dataType: "string", role: "identifier", normalisedField: "url", required: true },
      { sourceField: "statusCode", dataType: "number", role: "metric", normalisedField: "statusCode" },
      { sourceField: "title", dataType: "string", role: "attribute", normalisedField: "title" },
      { sourceField: "metaDescription", dataType: "string", role: "attribute", normalisedField: "metaDescription" },
      { sourceField: "canonicalUrl", dataType: "string", role: "attribute", normalisedField: "canonicalUrl" },
      { sourceField: "noindex", dataType: "boolean", role: "attribute", normalisedField: "noindex" },
    ],
  }),
});

export function marketingConnectorDefinition(provider) {
  const key = String(provider || "").trim().toLowerCase();
  const value = CONNECTORS[key];
  if (!value) {
    const error = new Error(`Unknown marketing connector: ${provider}`);
    error.statusCode = 400;
    error.code = "MARKETING_CONNECTOR_NOT_FOUND";
    throw error;
  }
  return value;
}

export function marketingConnectorCatalogue() {
  return Object.freeze({
    version: MARKETING_CONNECTOR_CATALOGUE_VERSION,
    connectors: Object.freeze(Object.values(CONNECTORS)),
  });
}

export default {
  MARKETING_CONNECTOR_CATALOGUE_VERSION,
  marketingConnectorCatalogue,
  marketingConnectorDefinition,
};
