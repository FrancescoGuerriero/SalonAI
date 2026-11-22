import mongoose from "mongoose";
import Location from "../../models/Location.js";
import Product from "../commerce/Product.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import SellerChannelLocationMappingProposal from "../../models/SellerChannelLocationMappingProposal.js";
import AuditLog from "../../models/AuditLog.js";
import { withSellerAtomicSourceCommit } from "./sellerChannelAtomicCommit.js";
import { createServiceError } from "../../shared/serviceError.js";

function fail(code, status = 409) {
  return createServiceError("Seller location mapping proposal refused.", status, { code });
}

function requireAuthority(connection, { businessId, locationAccessMode }) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection?.business) !== String(businessId) ||
      connection?.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection?.provider)) {
    throw fail("SELLER_LOCATION_PROPOSAL_AUTHORITY_REQUIRED", 403);
  }
  if (locationAccessMode !== "all") {
    throw fail("SELLER_LOCATION_PROPOSAL_SCOPE_REQUIRED", 403);
  }
}

const normalizedSku = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

/**
 * Create an AUDITED OPERATOR CANDIDATE, not a verified provider-location
 * mapping. Staged listings expose SKU and (sometimes aggregated) quantity,
 * not a trustworthy source fulfilment-location identity.
 *
 * All ownership checks, insert and audit event occur in one transaction.
 * There is intentionally no approval, activation or stock-write path.
 */
export async function proposeSellerLocationMapping(connection, {
  businessId, locationAccessMode, actorId, externalListingId,
  commerceProductId, commerceLocationId, requestId = "",
  stagedModel = SellerChannelStagingRecord, productModel = Product,
  locationModel = Location, proposalModel = SellerChannelLocationMappingProposal,
  auditModel = AuditLog, startSession = () => mongoose.startSession(),
} = {}) {
  requireAuthority(connection, { businessId, locationAccessMode });
  if (!mongoose.isValidObjectId(actorId) ||
      !mongoose.isValidObjectId(commerceProductId) ||
      !mongoose.isValidObjectId(commerceLocationId) ||
      typeof externalListingId !== "string" ||
      !/^[^\u0000-\u001f\u007f]{1,200}$/u.test(externalListingId) ||
      externalListingId.trim() !== externalListingId ||
      typeof requestId !== "string" || requestId.length > 120) {
    throw fail("SELLER_LOCATION_PROPOSAL_INPUT_INVALID", 400);
  }
  return withSellerAtomicSourceCommit(async (session) => {
    const staged = await stagedModel.findOne({
      business: businessId, connection: connection._id, provider: connection.provider,
      kind: "listings", externalId: externalListingId,
    }).session(session)
      .select("business connection provider kind externalId sourceRecord.sku lastObservedAt")
      .lean();
    const sku = normalizedSku(staged?.sourceRecord?.sku);
    const observedAt = new Date(staged?.lastObservedAt);
    if (!staged || String(staged.business) !== String(businessId) ||
        String(staged.connection) !== String(connection._id) ||
        staged.provider !== connection.provider || staged.kind !== "listings" ||
        staged.externalId !== externalListingId || !sku || sku.length > 200 ||
        !Number.isFinite(observedAt.getTime()) ||
        observedAt.getTime() > Date.now() + 300000) {
      throw fail("SELLER_LOCATION_PROPOSAL_SOURCE_UNVERIFIED", 409);
    }

    const location = await locationModel.findOne({
      _id: commerceLocationId, business: businessId, status: "active",
    }).session(session).select("_id business status").lean();
    if (!location || String(location._id) !== String(commerceLocationId) ||
        String(location.business) !== String(businessId) ||
        location.status !== "active") {
      throw fail("SELLER_LOCATION_PROPOSAL_LOCATION_UNVERIFIED", 409);
    }

    const product = await productModel.findOne({
      _id: commerceProductId, business: businessId, location: commerceLocationId,
    }).session(session).select("_id business location sku").lean();
    if (!product || String(product._id) !== String(commerceProductId) ||
        String(product.business) !== String(businessId) ||
        String(product.location) !== String(commerceLocationId) ||
        normalizedSku(product.sku) !== sku) {
      throw fail("SELLER_LOCATION_PROPOSAL_PRODUCT_UNVERIFIED", 409);
    }

    const duplicate = await proposalModel.findOne({
      business: businessId, connection: connection._id,
      externalListingId,
    }).session(session).select("_id").lean();
    if (duplicate) throw fail("SELLER_LOCATION_PROPOSAL_CONFLICT");

    let proposal;
    try {
      [proposal] = await proposalModel.create([{
        business: businessId, connection: connection._id,
        provider: connection.provider, externalListingId,
        sourceSku: sku, commerceProduct: commerceProductId,
        commerceLocation: commerceLocationId, proposedBy: actorId,
        sourceObservedAt: observedAt,
        reviewStatus: "pending_provider_location_evidence",
        evidenceSource: "operator_candidate",
      }], { session });
    } catch (error) {
      if (error?.code === 11000) throw fail("SELLER_LOCATION_PROPOSAL_CONFLICT");
      throw error;
    }

    await auditModel.create([{
      actor: actorId, action: "seller_location_mapping_proposed",
      resourceType: "SellerChannelLocationMappingProposal",
      resourceId: String(proposal._id),
      requestId, before: null,
      after: { reviewStatus: "pending_provider_location_evidence" },
      metadata: {
        businessId: String(businessId), connectionId: String(connection._id),
        provider: connection.provider, commerceLocationId: String(commerceLocationId),
      },
    }], { session });

    return Object.freeze({
      id: String(proposal._id), externalListingId,
      sourceSku: sku, proposedCommerceProductId: String(commerceProductId),
      proposedCommerceLocationId: String(commerceLocationId),
      reviewStatus: "pending_provider_location_evidence",
      sourceLocationVerified: false, locationMappingVerified: false,
      quantityComparisonAccepted: false, associationApproved: false,
      auditRecorded: true, canonicalRecordsWritten: 0, stockUpdatesApplied: 0,
      providerWritesEnabled: false, productionAccepted: false,
    });
  }, { startSession });
}

/**
 * Read-only, scoped review of candidate records; intentionally exposes no
 * canonical stock quantities or provider credentials.
 */
export async function listSellerLocationMappingProposals(connection, {
  businessId, locationAccessMode, limit = 50,
  proposalModel = SellerChannelLocationMappingProposal,
} = {}) {
  requireAuthority(connection, { businessId, locationAccessMode });
  const count = Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw fail("SELLER_LOCATION_PROPOSAL_LIMIT_INVALID", 400);
  }
  const rows = await proposalModel.find({
    business: businessId, connection: connection._id, provider: connection.provider,
  }).select(
    "business connection provider externalListingId sourceSku commerceProduct commerceLocation reviewStatus evidenceSource sourceObservedAt",
  ).sort({ createdAt: -1, _id: -1 }).limit(count).lean();
  if (!Array.isArray(rows) || rows.length > count) {
    throw fail("SELLER_LOCATION_PROPOSAL_EVIDENCE_INVALID", 502);
  }
  const seen = new Set();
  const records = rows.map((row) => {
    if (!row || String(row.business) !== String(businessId) ||
        String(row.connection) !== String(connection._id) ||
        row.provider !== connection.provider ||
        typeof row.externalListingId !== "string" || !row.externalListingId ||
        row.externalListingId.length > 200 || seen.has(row.externalListingId) ||
        normalizedSku(row.sourceSku) !== row.sourceSku ||
        !mongoose.isValidObjectId(row.commerceProduct) ||
        !mongoose.isValidObjectId(row.commerceLocation) ||
        row.reviewStatus !== "pending_provider_location_evidence" ||
        row.evidenceSource !== "operator_candidate") {
      throw fail("SELLER_LOCATION_PROPOSAL_EVIDENCE_INVALID", 502);
    }
    seen.add(row.externalListingId);
    return Object.freeze({
      externalListingId: row.externalListingId,
      sourceSku: row.sourceSku,
      proposedCommerceProductId: String(row.commerceProduct),
      proposedCommerceLocationId: String(row.commerceLocation),
      reviewStatus: row.reviewStatus,
      sourceLocationVerified: false, locationMappingVerified: false,
      quantityComparisonAccepted: false, associationApproved: false,
      canonicalRecordsWritten: 0, providerWritesEnabled: false,
    });
  });
  return Object.freeze({
    records: Object.freeze(records),
    reviewedCount: records.length, possiblyTruncated: records.length === count,
    locationMappingVerified: false, stockUpdatesApplied: 0,
    canonicalRecordsWritten: 0, readOnly: true, productionAccepted: false,
  });
}
