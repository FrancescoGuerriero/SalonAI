import mongoose from "mongoose";
import SellerChannelImportLease from "../../models/SellerChannelImportLease.js";
import SellerChannelSyncCheckpoint from "../../models/SellerChannelSyncCheckpoint.js";
import SellerChannelImportRun from "../../models/SellerChannelImportRun.js";
import { createServiceError } from "../../shared/serviceError.js";

const KINDS = Object.freeze(["listings", "orders"]);
const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Read-only operational status. No lock owner, encrypted cursor, buyer
 * payload or provider account credential is ever returned.
 * Expiry is reported separately from MongoDB's asynchronous TTL cleanup.
 */
export async function inspectSellerChannelImportStatus(connection, {
  businessId, now = new Date(),
  leaseModel = SellerChannelImportLease,
  checkpointModel = SellerChannelSyncCheckpoint,
  runModel = SellerChannelImportRun,
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection?.business) !== String(businessId) ||
      connection.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection.provider)) {
    throw createServiceError("Trusted connected seller account authority is required.", 403, {
      code: "SELLER_IMPORT_STATUS_AUTHORITY_REQUIRED",
    });
  }
  const scope = { business: businessId, connection: connection._id };
  const [leases, checkpoints, latestRuns] = await Promise.all([
    leaseModel.find(scope).select("kind expiresAt").lean(),
    checkpointModel.find({ ...scope, provider: connection.provider })
      .select("kind lastObservedAt stagedCount pagesFetched sourcePageComplete resumeSupported").lean(),
    Promise.all(KINDS.map((kind) => runModel.findOne({
      ...scope, provider: connection.provider, kind,
    }).select("kind state stagedCount startedAt finishedAt failureClass")
      .sort({ startedAt: -1, _id: -1 }).lean())),
  ]);
  if (!Array.isArray(leases) || !Array.isArray(checkpoints)) {
    throw createServiceError("Seller import status could not be verified.", 503);
  }
  const instant = new Date(now).getTime();
  if (!Number.isFinite(instant)) throw createServiceError("Invalid observation timestamp.", 400);
  const byKind = new Map(checkpoints.filter((row) => KINDS.includes(row.kind))
    .map((row) => [row.kind, row]));
  const statuses = KINDS.map((kind) => {
    const checkpoint = byKind.get(kind);
    const run = latestRuns.find((item) => item?.kind === kind);
    const lease = leases.find((row) => row.kind === kind);
    const expiration = lease?.expiresAt ? new Date(lease.expiresAt).getTime() : null;
    const lockState = expiration == null ? "idle" :
      Number.isFinite(expiration) && expiration > instant ? "active" : "expired_pending_cleanup";
    return Object.freeze({
      kind, lockState, lockExpiresAt: safeDate(lease?.expiresAt),
      lastObservedAt: safeDate(checkpoint?.lastObservedAt),
      stagedCount: checkpoint?.stagedCount ?? null,
      pagesFetched: checkpoint?.pagesFetched ?? null,
      sourcePageComplete: checkpoint?.sourcePageComplete === true,
      resumeAvailable: checkpoint?.resumeSupported === true,
      latestRunState: run?.state || null,
      latestRunFailureClass: run?.state === "failed" ? run.failureClass || "unknown" : null,
      latestRunStartedAt: safeDate(run?.startedAt),
      latestRunFinishedAt: safeDate(run?.finishedAt),
      recoveryReviewRequired: Boolean(run && run.state !== "completed" && lockState !== "active"),
      historicalSyncComplete: false,
      canonicalRecordsWritten: 0,
    });
  });
  return Object.freeze({
    provider: connection.provider, connectionId: String(connection._id),
    status: "observations_only", kinds: Object.freeze(statuses),
    productionAccepted: false,
  });
}
