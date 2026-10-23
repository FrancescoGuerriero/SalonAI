import mongoose from "mongoose";

import MarketingSyncRun from "../../models/MarketingSyncRun.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";

export async function retryMarketingSyncRun(runId, payload = {}, { businessId, actor = null } = {}) {
  if (!mongoose.isValidObjectId(runId)) {
    throw createServiceError("Sync run must be a valid identifier.", 400, { field: "run" });
  }

  const prior = await MarketingSyncRun.findOne({ _id: runId, business: businessId }).lean();
  if (!prior) throw createServiceError("Marketing sync run not found.", 404);
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
    { businessId, actor }
  );
}

export default { retryMarketingSyncRun };
