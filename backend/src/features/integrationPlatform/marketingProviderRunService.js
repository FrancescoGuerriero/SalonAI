import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { fetchMarketingProviderRecords } from "./marketingProviderAdapters.js";

const LIVE_PROVIDERS = new Set(["ga4", "google_search_console", "bing_webmaster"]);

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

  const providerResult = await fetchMarketingProviderRecords(source, payload);
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
