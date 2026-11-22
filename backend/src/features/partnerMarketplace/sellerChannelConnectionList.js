import mongoose from "mongoose";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";

export async function listSellerChannelConnections({
  businessId, locationAccessMode, connectionModel = IntegrationConnection,
} = {}) {
  if (!mongoose.isValidObjectId(businessId) || locationAccessMode !== "all") {
    throw createServiceError("Trusted business-wide seller access required.", 403, {
      code: "SELLER_CONNECTION_LIST_AUTHORITY_REQUIRED",
    });
  }
  const rows = await connectionModel.find({
    business: businessId,
    provider: { $in: ["amazon_seller_central", "ebay"] },
    status: "connected",
  }).select("_id business provider connectionKey status connectedAt lastSyncAt")
    .sort({ updatedAt: -1, _id: -1 }).limit(50).lean();
  if (!Array.isArray(rows) || rows.length > 50) {
    throw createServiceError("Unexpected seller connection records.", 502, {
      code: "SELLER_CONNECTION_LIST_EVIDENCE_INVALID",
    });
  }
  const connections = rows.map((row) => {
    if (String(row.business) !== String(businessId) ||
        !mongoose.isValidObjectId(row._id) || row.status !== "connected" ||
        !["amazon_seller_central", "ebay"].includes(row.provider)) {
      throw createServiceError("Invalid seller connection evidence.", 502, {
        code: "SELLER_CONNECTION_LIST_EVIDENCE_INVALID",
      });
    }
    return Object.freeze({
      id: String(row._id), provider: row.provider,
      connectionKey: String(row.connectionKey || "").slice(0, 120),
      status: row.status,
      connectedAt: row.connectedAt instanceof Date ? row.connectedAt.toISOString() : null,
      lastSyncAt: row.lastSyncAt instanceof Date ? row.lastSyncAt.toISOString() : null,
    });
  });
  return Object.freeze({
    connections: Object.freeze(connections),
    possiblyTruncated: rows.length === 50,
    credentialsIncluded: false,
    productionAccepted: false,
  });
}
