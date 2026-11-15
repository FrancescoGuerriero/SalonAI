import mongoose from "mongoose";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Tenant-wide staged order-state visibility only.
 *
 * Seller staging records do not carry a trusted location identifier.
 * Therefore location-restricted memberships MUST NOT receive these records.
 * This is not a Commerce order reconciliation, returns API or execution path.
 */
export async function inspectSellerChannelOrderStates(connection, {
  businessId,
  locationAccessMode,
  limit = 50,
  stagedModel = SellerChannelStagingRecord,
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection?.business || "") !== String(businessId) ||
      connection?.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection?.provider)) {
    throw createServiceError("Trusted connected seller authority is required.", 403, {
      code: "SELLER_ORDER_STATES_TENANT_REQUIRED",
    });
  }
  if (locationAccessMode !== "all") {
    throw createServiceError("Staged seller orders are not location-scoped.", 403, {
      code: "SELLER_ORDER_STATES_LOCATION_SCOPE_REQUIRED",
    });
  }
  const count = Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw createServiceError("Seller order-state limit must be 1-50.", 400, {
      code: "SELLER_ORDER_STATES_INVALID_LIMIT",
    });
  }
  const rows = await stagedModel.find({
    business: businessId, connection: connection._id,
    provider: connection.provider, kind: "orders",
  }).sort({ lastObservedAt: -1, _id: -1 }).limit(count).lean();
  if (!Array.isArray(rows)) {
    throw createServiceError("Staged seller order evidence is unavailable.", 502, {
      code: "SELLER_ORDER_STATES_UNAVAILABLE",
    });
  }
  const seen = new Set();
  const observations = rows.map((row) => {
    const externalOrderId = row?.externalId;
    if (typeof externalOrderId !== "string" || !externalOrderId.trim() ||
        externalOrderId.length > 200 || seen.has(externalOrderId) ||
        String(row?.business || "") !== String(businessId) ||
        String(row?.connection || "") !== String(connection._id) ||
        row?.provider !== connection.provider || row?.kind !== "orders") {
      throw createServiceError("Staged seller order evidence is inconsistent.", 502, {
        code: "SELLER_ORDER_STATES_INVALID_EVIDENCE",
      });
    }
    seen.add(externalOrderId);
    const raw = row.sourceRecord || {};
    const state = typeof raw.status === "string" && raw.status.trim()
      ? raw.status.trim().slice(0, 120) : null;
    const fulfillment = typeof raw.fulfillmentStatus === "string" &&
      raw.fulfillmentStatus.trim() ? raw.fulfillmentStatus.trim().slice(0, 120) : null;
    return Object.freeze({
      externalOrderId,
      observedOrderState: state,
      observedFulfillmentState: fulfillment,
      reviewState: !state || !fulfillment ? "insufficient_provider_state" :
        state !== fulfillment ? "provider_state_disagreement" : "observation_only",
      lastObservedAt: row.lastObservedAt || null,
      returnsStatus: "not_implemented",
    });
  });
  return Object.freeze({
    businessId: String(businessId),
    connectionId: String(connection._id),
    provider: connection.provider,
    records: Object.freeze(observations),
    inspectedCount: observations.length,
    truncated: observations.length === count,
    source: "staged_provider_observations",
    canonicalOrdersCompared: false,
    canonicalRecordsWritten: 0,
    refundsIssued: 0,
    fulfillmentWrites: 0,
    productionAccepted: false,
    readOnly: true,
  });
}

export default inspectSellerChannelOrderStates;
