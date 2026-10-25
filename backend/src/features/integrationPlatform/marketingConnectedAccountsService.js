import { createHash } from "node:crypto";
import mongoose from "mongoose";

import CredentialVersion from "../../models/CredentialVersion.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import { storeProviderCredential } from "./providerCredentialService.js";

const MARKETING_CONNECTIONS_APP_KEY = "marketing-data-connections";

function field(key, label, { placeholder = "", help = "", required = true } = {}) {
  return Object.freeze({ key, label, placeholder, help, required, secret: false });
}

function credential(key, label, role, { placeholder = "", help = "", required = true } = {}) {
  return Object.freeze({ key, label, role, placeholder, help, required, secret: true });
}

function provider(value) {
  return Object.freeze({
    ...value,
    fields: Object.freeze(value.fields || []),
    credentials: Object.freeze(value.credentials || []),
    scopes: Object.freeze(value.scopes || []),
  });
}

const PROVIDERS = Object.freeze({
  google_ads: provider({
    key: "google_ads",
    label: "Google Ads",
    category: "Advertising",
    description: "Import campaign, ad group, keyword, spend, click and conversion performance from Google Ads.",
    documentationUrl: "https://developers.google.com/google-ads/api/docs/oauth/overview",
    fields: [
      field("clientId", "OAuth client ID", { placeholder: "1234567890-...apps.googleusercontent.com" }),
      field("customerId", "Google Ads customer ID", { placeholder: "123-456-7890" }),
      field("loginCustomerId", "Manager account (MCC) ID", { placeholder: "123-456-7890", help: "Optional unless you access the client through a manager account.", required: false }),
    ],
    credentials: [
      credential("developerToken", "Developer token", "api_key", { help: "Google Ads API developer token." }),
      credential("clientSecret", "OAuth client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false, help: "Optional short-lived token; a refresh-token executor will be added before live scheduled sync." }),
    ],
    scopes: ["https://www.googleapis.com/auth/adwords"],
  }),
  meta_ads: provider({
    key: "meta_ads",
    label: "Meta Ads",
    category: "Advertising",
    description: "Import Facebook and Instagram advertising performance from the Meta Marketing API.",
    documentationUrl: "https://developers.facebook.com/docs/marketing-apis/",
    fields: [
      field("appId", "Meta App ID", { placeholder: "123456789012345" }),
      field("adAccountId", "Ad account ID", { placeholder: "act_1234567890" }),
      field("businessId", "Meta Business ID", { placeholder: "123456789012345", required: false }),
    ],
    credentials: [
      credential("appSecret", "Meta App secret", "client_secret"),
      credential("accessToken", "System user / OAuth access token", "access_token"),
    ],
    scopes: ["ads_read", "read_insights"],
  }),
  linkedin_ads: provider({
    key: "linkedin_ads",
    label: "LinkedIn Ads",
    category: "Advertising",
    description: "Import LinkedIn Campaign Manager spend, delivery and conversion reporting.",
    documentationUrl: "https://learn.microsoft.com/linkedin/marketing/quick-start",
    fields: [
      field("clientId", "LinkedIn client ID"),
      field("adAccountUrn", "Ad account URN / ID", { placeholder: "urn:li:sponsoredAccount:123456" }),
      field("organisationUrn", "Organisation URN", { placeholder: "urn:li:organization:123456", required: false }),
    ],
    credentials: [
      credential("clientSecret", "LinkedIn client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token", { required: false }),
      credential("accessToken", "OAuth access token", "access_token"),
    ],
    scopes: ["r_ads", "r_ads_reporting"],
  }),
  microsoft_ads: provider({
    key: "microsoft_ads",
    label: "Microsoft Advertising",
    category: "Advertising",
    description: "Import Microsoft Advertising (Bing Ads) campaign, spend and conversion reporting.",
    documentationUrl: "https://learn.microsoft.com/advertising/guides/authentication-oauth-quick-start",
    fields: [
      field("clientId", "Application / client ID"),
      field("accountId", "Advertising account ID"),
      field("customerId", "Customer ID"),
    ],
    credentials: [
      credential("developerToken", "Developer token", "api_key"),
      credential("clientSecret", "Client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false }),
    ],
    scopes: ["https://ads.microsoft.com/msads.manage"],
  }),
  tiktok_ads: provider({
    key: "tiktok_ads",
    label: "TikTok Ads",
    category: "Advertising",
    description: "Import TikTok Ads campaign, creative and advertiser performance.",
    documentationUrl: "https://business-api.tiktok.com/portal/docs",
    fields: [
      field("appId", "TikTok app ID"),
      field("advertiserId", "Advertiser ID"),
    ],
    credentials: [
      credential("appSecret", "TikTok app secret", "client_secret"),
      credential("accessToken", "Advertiser access token", "access_token"),
    ],
    scopes: ["reporting"],
  }),
  facebook_pages: provider({
    key: "facebook_pages",
    label: "Facebook Pages",
    category: "Organic social",
    description: "Import Page reach, engagement, audience and content performance.",
    documentationUrl: "https://developers.facebook.com/docs/graph-api/",
    fields: [field("pageId", "Facebook Page ID")],
    credentials: [credential("accessToken", "Page / system user access token", "access_token")],
    scopes: ["pages_read_engagement", "read_insights"],
  }),
  instagram_organic: provider({
    key: "instagram_organic",
    label: "Instagram Organic",
    category: "Organic social",
    description: "Import Instagram professional profile, post, reel and audience insights.",
    documentationUrl: "https://developers.facebook.com/docs/instagram-platform/",
    fields: [
      field("instagramProfessionalAccountId", "Instagram professional account ID"),
      field("facebookPageId", "Linked Facebook Page ID", { required: false }),
    ],
    credentials: [credential("accessToken", "Meta access token", "access_token")],
    scopes: ["instagram_basic", "instagram_manage_insights"],
  }),
  linkedin_pages: provider({
    key: "linkedin_pages",
    label: "LinkedIn Pages",
    category: "Organic social",
    description: "Import organisation Page posts, follower and engagement analytics.",
    documentationUrl: "https://learn.microsoft.com/linkedin/marketing/community-management/",
    fields: [
      field("clientId", "LinkedIn client ID"),
      field("organisationUrn", "Organisation URN", { placeholder: "urn:li:organization:123456" }),
    ],
    credentials: [
      credential("clientSecret", "LinkedIn client secret", "client_secret"),
      credential("accessToken", "OAuth access token", "access_token"),
      credential("refreshToken", "OAuth refresh token", "refresh_token", { required: false }),
    ],
    scopes: ["r_organization_social"],
  }),
  google_business_profile: provider({
    key: "google_business_profile",
    label: "Google Business Profile",
    category: "Local & reputation",
    description: "Import Google Business Profile location and performance information.",
    documentationUrl: "https://developers.google.com/my-business/content/basic-setup",
    fields: [
      field("clientId", "Google OAuth client ID"),
      field("accountId", "Business Profile account ID", { placeholder: "accounts/123456789" }),
      field("locationId", "Location ID", { placeholder: "locations/987654321" }),
    ],
    credentials: [
      credential("clientSecret", "Google OAuth client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false }),
    ],
    scopes: ["https://www.googleapis.com/auth/business.manage"],
  }),
  ga4: provider({
    key: "ga4",
    label: "Google Analytics 4",
    category: "Analytics & search",
    description: "Import GA4 traffic, event, acquisition and conversion data.",
    documentationUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries",
    fields: [
      field("clientId", "Google OAuth client ID"),
      field("propertyId", "GA4 property ID", { placeholder: "123456789" }),
    ],
    credentials: [
      credential("clientSecret", "Google OAuth client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false }),
    ],
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  }),
  google_search_console: provider({
    key: "google_search_console",
    label: "Google Search Console",
    category: "Analytics & search",
    description: "Import organic search queries, pages, clicks, impressions and ranking position.",
    documentationUrl: "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
    fields: [
      field("clientId", "Google OAuth client ID"),
      field("siteUrl", "Search Console property", { placeholder: "https://example.com/" }),
    ],
    credentials: [
      credential("clientSecret", "Google OAuth client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false }),
    ],
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }),
  shopify: provider({
    key: "shopify",
    label: "Shopify",
    category: "Commerce & payments",
    description: "Import store, order, customer and product performance for blended revenue reporting.",
    documentationUrl: "https://shopify.dev/docs/api/admin-rest/usage/access-scopes",
    fields: [field("shopDomain", "Shop domain", { placeholder: "your-store.myshopify.com" })],
    credentials: [credential("accessToken", "Admin API access token", "access_token")],
    scopes: ["read_orders", "read_products", "read_customers"],
  }),
  stripe: provider({
    key: "stripe",
    label: "Stripe",
    category: "Commerce & payments",
    description: "Import governed payment, charge, refund and revenue evidence for BI reconciliation.",
    documentationUrl: "https://docs.stripe.com/keys",
    fields: [field("accountId", "Stripe account ID", { placeholder: "acct_...", required: false })],
    credentials: [credential("apiKey", "Restricted / secret API key", "api_key", { help: "Prefer a restricted read-only key for reporting." })],
    scopes: ["payments:read"],
  }),
  hubspot: provider({
    key: "hubspot",
    label: "HubSpot",
    category: "CRM & automation",
    description: "Import contacts, companies, deals and marketing activity from HubSpot.",
    documentationUrl: "https://developers.hubspot.com/docs/api/private-apps",
    fields: [field("portalId", "HubSpot account / portal ID", { required: false })],
    credentials: [credential("accessToken", "Private app / OAuth access token", "access_token")],
    scopes: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
  }),
  mailchimp: provider({
    key: "mailchimp",
    label: "Mailchimp",
    category: "CRM & automation",
    description: "Import audiences, campaigns, opens, clicks and email performance.",
    documentationUrl: "https://mailchimp.com/developer/marketing/api-concepts/authentication/",
    fields: [field("serverPrefix", "Data centre / server prefix", { placeholder: "us21", help: "The suffix from your Mailchimp API endpoint, for example us21." })],
    credentials: [credential("apiKey", "Mailchimp API key", "api_key")],
    scopes: ["marketing:read"],
  }),
  youtube_analytics: provider({
    key: "youtube_analytics",
    label: "YouTube Analytics",
    category: "Organic social",
    description: "Import channel, video, audience and engagement analytics from YouTube.",
    documentationUrl: "https://developers.google.com/youtube/analytics/quickstart/web-app",
    fields: [
      field("clientId", "Google OAuth client ID"),
      field("channelId", "YouTube channel ID", { placeholder: "UC..." }),
    ],
    credentials: [
      credential("clientSecret", "Google OAuth client secret", "client_secret"),
      credential("refreshToken", "OAuth refresh token", "refresh_token"),
      credential("accessToken", "OAuth access token", "access_token", { required: false }),
    ],
    scopes: ["https://www.googleapis.com/auth/yt-analytics.readonly"],
  }),
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function objectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${fieldName} must be a valid identifier.`, 400, { field: fieldName });
  }
  return value;
}

function providerDefinition(value) {
  const key = text(value, 80).toLowerCase().replaceAll("-", "_");
  const definition = PROVIDERS[key];
  if (!definition) throw createServiceError(`Unsupported marketing provider: ${key || "unknown"}.`, 400, { code: "MARKETING_PROVIDER_UNSUPPORTED" });
  return definition;
}

function hashReference(value) {
  const normalised = text(value, 1000);
  return normalised ? createHash("sha256").update(normalised).digest("hex") : "";
}

function metadataFor(definition, payload = {}) {
  const supplied = payload.account && typeof payload.account === "object" && !Array.isArray(payload.account)
    ? payload.account
    : payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};
  const metadata = { displayName: text(supplied.displayName ?? payload.displayName, 180) };
  for (const item of definition.fields) metadata[item.key] = text(supplied[item.key] ?? payload[item.key], 1000);
  return metadata;
}

function storedRoles(connection) {
  return new Set((connection?.credentialBindings || []).filter((item) => item?.credential).map((item) => item.role));
}

function readiness(definition, connection) {
  const roles = storedRoles(connection);
  const missingFields = definition.fields.filter((item) => item.required && !text(connection?.metadata?.[item.key], 1000)).map((item) => item.key);
  const missingCredentials = definition.credentials.filter((item) => item.required && !roles.has(item.role)).map((item) => item.key);
  const disconnected = !connection || ["disconnected", "revoked"].includes(connection.status);
  const ready = Boolean(connection) && !disconnected && missingFields.length === 0 && missingCredentials.length === 0;
  return { ready, missingFields, missingCredentials };
}

function serialise(definition, connection = null) {
  const state = readiness(definition, connection);
  let readinessState = "not_connected";
  if (connection) {
    if (["disconnected", "revoked"].includes(connection.status)) readinessState = "disconnected";
    else if (state.ready) readinessState = "configured";
    else readinessState = "needs_attention";
  }
  const metadata = { displayName: text(connection?.metadata?.displayName, 180) };
  for (const item of definition.fields) metadata[item.key] = text(connection?.metadata?.[item.key], 1000);
  return {
    provider: definition.key,
    label: definition.label,
    category: definition.category,
    description: definition.description,
    documentationUrl: definition.documentationUrl,
    fields: definition.fields.map((item) => ({ ...item })),
    credentials: definition.credentials.map((item) => ({ ...item, stored: storedRoles(connection).has(item.role) })),
    scopes: [...definition.scopes],
    connectionId: connection?._id || null,
    status: connection?.status || "disconnected",
    readiness: readinessState,
    ready: state.ready,
    missingFields: state.missingFields,
    missingCredentials: state.missingCredentials,
    metadata,
    connectedAt: connection?.connectedAt || null,
    disconnectedAt: connection?.disconnectedAt || null,
    tokenExpiresAt: connection?.tokenExpiresAt || null,
    liveSyncEnabled: false,
  };
}

async function marketingApp(businessId, ownerUser = null, { create = false } = {}) {
  objectId(businessId, "business");
  let app = await IntegrationApp.findOne({ business: businessId, key: MARKETING_CONNECTIONS_APP_KEY });
  if (!app && create) {
    app = await IntegrationApp.create({
      business: businessId,
      key: MARKETING_CONNECTIONS_APP_KEY,
      name: "Marketing data connections",
      description: "Tenant-owned provider connections for the AIIBP Marketing Data Hub.",
      ownerUser: mongoose.isValidObjectId(ownerUser) ? ownerUser : null,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      status: "active",
      scopes: ["analytics:read", "campaigns:read"],
      metadata: { managedBy: "marketing_connections_ui", liveSyncEnabled: false },
    });
  }
  if (app?.status === "revoked" && create) throw createServiceError("Marketing connections integration has been revoked.", 409);
  return app;
}

export function marketingConnectedAccountCatalogue() {
  return { version: "1.0.0", liveSyncEnabled: false, items: Object.values(PROVIDERS).map((item) => serialise(item)) };
}

export async function listMarketingConnectedAccounts({ businessId } = {}) {
  const app = await marketingApp(businessId);
  const connections = app ? await IntegrationConnection.find({ business: businessId, app: app._id, provider: { $in: Object.keys(PROVIDERS) } }).lean() : [];
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));
  return {
    version: "1.0.0",
    liveSyncEnabled: false,
    message: "Connections may be configured now. Live provider sync remains disabled until each adapter passes controlled acceptance.",
    items: Object.values(PROVIDERS).map((definition) => serialise(definition, byProvider.get(definition.key) || null)),
  };
}

export async function configureMarketingConnectedAccount(providerKey, payload = {}, { businessId, actorUser = null } = {}) {
  const definition = providerDefinition(providerKey);
  const app = await marketingApp(businessId, actorUser, { create: true });
  const metadata = metadataFor(definition, payload);
  const missingFields = definition.fields.filter((item) => item.required && !metadata[item.key]);
  if (missingFields.length) {
    throw createServiceError(`Required account details are missing: ${missingFields.map((item) => item.label).join(", ")}.`, 400, { missingFields: missingFields.map((item) => item.key) });
  }

  let connection = await IntegrationConnection.findOne({ business: businessId, app: app._id, provider: definition.key, connectionKey: definition.key });
  if (!connection) {
    connection = await IntegrationConnection.create({
      business: businessId,
      app: app._id,
      provider: definition.key,
      connectionKey: definition.key,
      status: "pending",
      scopes: definition.scopes,
      metadata,
      externalAccountReferenceHash: hashReference(metadata[definition.fields[0]?.key]),
    });
  } else {
    if (connection.status === "revoked") throw createServiceError(`${definition.label} connection has been revoked and cannot be reused.`, 409);
    connection.metadata = metadata;
    connection.scopes = definition.scopes;
    connection.externalAccountReferenceHash = hashReference(metadata[definition.fields[0]?.key]);
    connection.status = "pending";
    connection.disconnectedAt = null;
    await connection.save();
  }

  const secretPayload = payload.credentials && typeof payload.credentials === "object" && !Array.isArray(payload.credentials) ? payload.credentials : payload;
  for (const item of definition.credentials) {
    const secret = text(secretPayload[item.key], 20000);
    if (!secret) continue;
    await storeProviderCredential(app._id, connection._id, {
      role: item.role,
      secret,
      expiresAt: item.role === "access_token" ? payload.tokenExpiresAt || null : null,
      metadata: { source: "marketing_connections_ui", provider: definition.key, field: item.key },
    }, { businessId });
  }

  connection = await IntegrationConnection.findOne({ _id: connection._id, business: businessId, app: app._id });
  const state = readiness(definition, connection);
  connection.status = state.ready ? "connected" : "pending";
  connection.connectedAt = state.ready ? (connection.connectedAt || new Date()) : connection.connectedAt;
  await connection.save();
  return serialise(definition, connection);
}

export async function disconnectMarketingConnectedAccount(providerKey, { businessId } = {}) {
  const definition = providerDefinition(providerKey);
  const app = await marketingApp(businessId);
  if (!app) throw createServiceError(`${definition.label} is not connected.`, 404);
  const connection = await IntegrationConnection.findOne({ business: businessId, app: app._id, provider: definition.key, connectionKey: definition.key });
  if (!connection) throw createServiceError(`${definition.label} is not connected.`, 404);

  const ids = (connection.credentialBindings || []).map((binding) => binding.credential).filter(Boolean);
  const now = new Date();
  if (ids.length) {
    await CredentialVersion.updateMany({ _id: { $in: ids }, business: businessId, app: app._id }, { $set: { status: "revoked", revokedAt: now, expiresAt: now } });
  }
  connection.credentialBindings = [];
  connection.status = "disconnected";
  connection.disconnectedAt = now;
  connection.tokenExpiresAt = null;
  await connection.save();
  return serialise(definition, connection);
}

export default {
  configureMarketingConnectedAccount,
  disconnectMarketingConnectedAccount,
  listMarketingConnectedAccounts,
  marketingConnectedAccountCatalogue,
};
