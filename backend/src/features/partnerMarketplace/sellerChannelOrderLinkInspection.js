import mongoose from "mongoose";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import SellerChannelOrderLink from "../../models/SellerChannelOrderLink.js";
import { inspectSellerOrderSourceEvidence } from "./sellerChannelOrderEvidence.js";
import { createServiceError } from "../../shared/serviceError.js";

function failure(message, code, status = 502) {
  return createServiceError(message, status, { code });
}

/**
 * Inspect explicit marketplace-to-Commerce link proposals only.
 * A stored proposal is not verified ownership, a canonical comparison,
 * fulfilment permission, or a production-ready order association.
 */
export async function inspectSellerChannelOrderLinks(connection, {
  businessId, locationAccessMode, limit = 50,
  stagedModel = SellerChannelStagingRecord,
  linkModel = SellerChannelOrderLink,
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection?.business || "") !== String(businessId) ||
      connection?.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection?.provider)) {
    throw failure("Connected seller authority is required.",
      "SELLER_ORDER_LINK_AUTHORITY_REQUIRED", 403);
  }
  if (locationAccessMode !== "all") {
    throw failure("Marketplace order records require business-wide authority.",
      "SELLER_ORDER_LINK_SCOPE_REQUIRED", 403);
  }
  const count = Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw failure("Order link review limit must be 1-50.",
      "SELLER_ORDER_LINK_LIMIT_INVALID", 400);
  }
  const rows = await stagedModel.find({
    business: businessId, connection: connection._id, provider: connection.provider,
    kind: "orders",
  }).sort({ lastObservedAt: -1, _id: -1 }).limit(count).lean();
  if (!Array.isArray(rows) || rows.length > count) {
    throw failure("Invalid marketplace order evidence.", "SELLER_ORDER_LINK_EVIDENCE_INVALID");
  }
  const ids = [];
  const evidenceByOrder = new Map();
  const seenStaged = new Set();
  for (const row of rows) {
    const id = row?.externalId;
    if (typeof id !== "string" || !id.trim() || id.length > 200 ||
        seenStaged.has(id) || String(row.business) !== String(businessId) ||
        String(row.connection) !== String(connection._id) ||
        row.provider !== connection.provider || row.kind !== "orders") {
      throw failure("Inconsistent marketplace order evidence.", "SELLER_ORDER_LINK_EVIDENCE_INVALID");
    }
    seenStaged.add(id);
    ids.push(id);
    evidenceByOrder.set(id, inspectSellerOrderSourceEvidence(row.sourceRecord));
  }
  const links = ids.length ? await linkModel.find({
    business: businessId, connection: connection._id,
    provider: connection.provider, externalOrderId: { $in: ids },
  }).select("externalOrderId commerceOrder verificationStatus evidenceSource business connection provider")
    .lean() : [];
  if (!Array.isArray(links) || links.length > ids.length) {
    throw failure("Invalid order link evidence.", "SELLER_ORDER_LINK_EVIDENCE_INVALID");
  }
  const byExternalId = new Map();
  const usedCommerceIds = new Set();
  for (const link of links) {
    const commerceId = link?.commerceOrder;
    if (!seenStaged.has(link?.externalOrderId) ||
        byExternalId.has(link.externalOrderId) ||
        String(link.business) !== String(businessId) ||
        String(link.connection) !== String(connection._id) ||
        link.provider !== connection.provider ||
        !mongoose.isValidObjectId(commerceId) ||
        usedCommerceIds.has(String(commerceId)) ||
        link.verificationStatus !== "pending_verification" ||
        link.evidenceSource !== "operator_proposal") {
      throw failure("Inconsistent order association evidence.", "SELLER_ORDER_LINK_EVIDENCE_INVALID");
    }
    byExternalId.set(link.externalOrderId, link);
    usedCommerceIds.add(String(commerceId));
  }
  const records = Object.freeze(ids.map((externalOrderId) => {
    const link = byExternalId.get(externalOrderId);
    return Object.freeze({
      externalOrderId,
      linkStatus: link ? "proposal_pending_verification" : "unlinked",
      proposedCommerceOrderId: link ? String(link.commerceOrder) : null,
      orderOwnershipVerified: false,
      commerceStateCompared: false,
      sourceEvidence: evidenceByOrder.get(externalOrderId),
    });
  }));
  const linkedProposals = byExternalId.size;
  return Object.freeze({
    businessId: String(businessId),
    connectionId: String(connection._id),
    provider: connection.provider,
    source: "staged_orders_and_explicit_link_proposals",
    records,
    inspectedCount: records.length,
    summary: Object.freeze({
      unlinked: records.length - linkedProposals,
      pendingVerification: linkedProposals,
      verified: 0,
      possiblyTruncated: rows.length === count,
    }),
    canonicalOrdersCompared: false,
    canonicalRecordsWritten: 0,
    linksWritten: 0,
    stockUpdatesApplied: 0,
    productionAccepted: false,
    readOnly: true,
  });
}
