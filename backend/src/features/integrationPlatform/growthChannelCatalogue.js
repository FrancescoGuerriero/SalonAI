export const GROWTH_CHANNEL_CATALOGUE_VERSION = "1.0.0";

function connector(value) {
  return Object.freeze({
    ...value,
    requiredScopes: Object.freeze([...(value.requiredScopes || [])]),
    capabilities: Object.freeze([...(value.capabilities || [])]),
    writeControls: Object.freeze({ ...(value.writeControls || {}) }),
  });
}

const CONNECTORS = Object.freeze([
  connector({
    key: "google_business_profile",
    label: "Google Business Profile",
    provider: "google_business_profile",
    auth: "oauth2",
    requiredScopes: ["https://www.googleapis.com/auth/business.manage"],
    capabilities: [
      "listing.read",
      "review.read",
      "review.reply",
      "performance.read",
    ],
    writeControls: {
      reviewReplyRequiresHumanApproval: true,
      listingWriteRequiresHumanApproval: true,
      automaticReviewReply: false,
    },
    api: {
      reviewBase: "https://mybusiness.googleapis.com/v4",
      businessInformationBase: "https://mybusinessbusinessinformation.googleapis.com/v1",
      performanceBase: "https://businessprofileperformance.googleapis.com/v1",
    },
  }),
  connector({
    key: "meta_social_leads",
    label: "Meta social leads",
    provider: "meta_social_leads",
    auth: "oauth2",
    requiredScopes: [],
    capabilities: [
      "lead.webhook",
      "lead.read",
      "campaign.attribution",
      "social.booking_attribution",
    ],
    writeControls: {
      automaticOutboundWrite: false,
      providerAppReviewRequiredBeforeLiveActivation: true,
    },
    api: {
      graphBase: "https://graph.facebook.com",
    },
  }),
  connector({
    key: "google_ads_attribution",
    label: "Google Ads attribution",
    provider: "google_ads_attribution",
    auth: "oauth2",
    requiredScopes: ["https://www.googleapis.com/auth/adwords"],
    capabilities: [
      "click.attribution",
      "campaign.attribution",
      "lead.attribution",
      "booking.attribution",
    ],
    writeControls: {
      conversionUploadRequiresExplicitActivation: true,
      automaticOutboundWrite: false,
    },
    api: {
      base: "https://googleads.googleapis.com",
    },
  }),
  connector({
    key: "generic_growth_webhook",
    label: "Generic growth webhook",
    provider: "generic_growth_webhook",
    auth: "signed_webhook",
    requiredScopes: [],
    capabilities: [
      "lead.webhook",
      "campaign.attribution",
      "booking.attribution",
    ],
    writeControls: {
      inboundOnly: true,
      signatureRequired: true,
    },
    api: {},
  }),
]);

export function growthChannelCatalogue() {
  return Object.freeze({
    version: GROWTH_CHANNEL_CATALOGUE_VERSION,
    connectors: CONNECTORS,
  });
}

export function growthChannelConnector(key) {
  const connectorDefinition = CONNECTORS.find((item) => item.key === String(key || "").trim());
  if (!connectorDefinition) {
    const error = new Error(`Unknown growth channel connector: ${key}`);
    error.code = "GROWTH_CHANNEL_CONNECTOR_NOT_FOUND";
    error.statusCode = 400;
    throw error;
  }
  return connectorDefinition;
}

export default {
  GROWTH_CHANNEL_CATALOGUE_VERSION,
  growthChannelCatalogue,
  growthChannelConnector,
};
