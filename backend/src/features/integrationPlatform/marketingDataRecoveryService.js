import mongoose from "mongoose";

import MarketingSyncRun from "../../models/MarketingSyncRun.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";

export async function retryMarketingSyncRun(
  runId,
  payload = {},
  { businessId, locationId = null, actor = null } = {}
) {
  if (!mongoose.isValidObjectId(runId)) {
    throw createServiceError("Sync run must be a valid identifier.", 400, { field: "run" });
  }

  const match = { _id: runId, business: businessId };
  if (locationId) match.location = locationId;
  const prior = await MarketingSyncRun.findOne(match).lean();
  if (!prior) throw createServiceError("Marketing sync run not found for this location.", 404);
  if (!prior.location) {
    throw createServiceError("Marketing sync run has no location ownership and cannot be retried automatically.", 409, {
      code: "MARKETING_SYNC_LOCATION_REQUIRED",
    });
  }
  if (!["failed", "partial"].includes(prior.status)) {
    throw createServiceError("Only failed or partial sync runs can be retried.", 409);
  }

  return runMarketingDataSource(
    prior.source,
    {
      ...payload,
      mode: payload.mode || prior.mode,
      retry: true,
      retryOf: prior._id,
      attempt: Number(prior.attempt || 1) + 1,
      start: payload.start || prior.requestedWindow?.start || undefined,
      end: payload.end || prior.requestedWindow?.end || undefined,
    },
    { businessId, locationId: prior.location, actor }
  );
}

export default { retryMarketingSyncRun };
