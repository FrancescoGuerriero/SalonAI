import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { fetchMarketingAdvertisingProviderRecords } from "./marketingAdvertisingProviderAdapters.js";
import { fetchMarketingCommerceProviderRecords } from "./marketingCommerceProviderAdapters.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { fetchMarketingFinalProviderRecords } from "./marketingFinalProviderAdapters.js";
import { fetchMarketingOrganicProviderRecords } from "./marketingOrganicProviderAdapters.js";
import { fetchMarketingProviderRecords } from "./marketingProviderAdapters.js";

const ADVERTISING_WAVE3_PROVIDERS = new Set(["linkedin_ads", "microsoft_ads", "tiktok_ads"]);
const ORGANIC_WAVE4_PROVIDERS = new Set(["facebook_pages", "instagram_organic", "linkedin_pages", "youtube_analytics"]);
const FINAL_WAVE5_PROVIDERS = new Set(["google_business_profile", "hubspot", "mailchimp"]);
const COMMERCE_PROVIDERS = new Set(["shopify", "stripe"]);
const LIVE_PROVIDERS = new Set([
  "ga4",
  "google_search_console",
  "bing_webmaster",
  "google_ads",
  "meta_ads",
  ...ADVERTISING_WAVE3_PROVIDERS,
  ...ORGANIC_WAVE4_PROVIDERS,
  ...FINAL_WAVE5_PROVIDERS,
  ...COMMERCE_PROVIDERS,
]);

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

export async function runMarketingProviderSource(
  sourceId,
  payload = {},
  { businessId, actor = null } = {}
) {
  objectId(sourceId, "source");
  objectId(businessId, "business");
  const source = await MarketingDataSource.findOne({ _id: sourceId, business: businessId });
  if (!source) throw createServiceError("Marketing data source not found.", 404);
  if (source.sourceConfig?.liveProviderExecution === false) {
    throw createServiceError("Live provider retrieval is not authorised for this source.", 409, {
      code: "MARKETING_PROVIDER_EXECUTION_NOT_AUTHORISED",
    });
  }
  if (!LIVE_PROVIDERS.has(source.provider)) {
    throw createServiceError(`Provider execution is not supported for source provider: ${source.provider}.`, 409, {
      code: "MARKETING_PROVIDER_EXECUTOR_NOT_AVAILABLE",
    });
  }
  if (source.status !== "active" && payload.force !== true) {
    throw createServiceError("Live provider retrieval requires an active source.", 409, {
      code: "MARKETING_PROVIDER_SOURCE_NOT_ACTIVE",
    });
  }

  const providerResult = ADVERTISING_WAVE3_PROVIDERS.has(source.provider)
    ? await fetchMarketingAdvertisingProviderRecords(source, payload)
    : ORGANIC_WAVE4_PROVIDERS.has(source.provider)
      ? await fetchMarketingOrganicProviderRecords(source, payload)
      : FINAL_WAVE5_PROVIDERS.has(source.provider)
        ? await fetchMarketingFinalProviderRecords(source, payload)
        : COMMERCE_PROVIDERS.has(source.provider)
          ? await fetchMarketingCommerceProviderRecords(source, payload)
          : await fetchMarketingProviderRecords(source, payload);
  const run = await runMarketingDataSource(
    source._id,
    {
      mode: payload.mode || source.syncMode || "incremental",
      start: payload.start,
      end: payload.end,
      records: providerResult.records,
      checkpoint: providerResult.checkpoint,
      retry: payload.retry,
      retryOf: payload.retryOf,
      attempt: payload.attempt,
    },
    { businessId, actor }
  );

  if (source.connection) {
    await IntegrationConnection.updateOne(
      { _id: source.connection, business: businessId, app: source.app },
      { $set: { lastSyncAt: new Date(), status: run.status === "failed" ? "degraded" : "connected" } }
    );
  }

  return {
    run,
    provider: source.provider,
    providerMeta: providerResult.providerMeta,
    retrievedRecords: providerResult.records.length,
  };
}

export default { runMarketingProviderSource };
