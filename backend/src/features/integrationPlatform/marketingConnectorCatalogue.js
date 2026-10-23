export const MARKETING_CONNECTOR_CATALOGUE_VERSION = "1.0.0";

function definition(value) {
  return Object.freeze({
    ...value,
    schemaVersion: value.schemaVersion || "1.0.0",
    requiredScopes: Object.freeze([...(value.requiredScopes || [])]),
    checkpointStrategies: Object.freeze([...(value.checkpointStrategies || [])]),
    defaultFields: Object.freeze((value.defaultFields || []).map((field) => Object.freeze({ ...field }))),
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
      { sourceField: "date", dataType: "date", role: "timestamp", normalisedField: "occurredAt", required: true },
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
      { sourceField: "date", dataType: "date", role: "timestamp", normalisedField: "occurredAt", required: true },
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
      { sourceField: "date", dataType: "date", role: "timestamp", normalisedField: "occurredAt", required: true },
      { sourceField: "query", dataType: "string", role: "dimension", normalisedField: "query" },
      { sourceField: "url", dataType: "string", role: "dimension", normalisedField: "page" },
      { sourceField: "clicks", dataType: "number", role: "metric", normalisedField: "clicks" },
      { sourceField: "impressions", dataType: "number", role: "metric", normalisedField: "impressions" },
      { sourceField: "averagePosition", dataType: "number", role: "metric", normalisedField: "position" },
    ],
  }),
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
