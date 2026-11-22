import mongoose from "mongoose";
import SellerChannelOrderLink from "../../models/SellerChannelOrderLink.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import AuditLog from "../../models/AuditLog.js";
import { withSellerAtomicSourceCommit } from "./sellerChannelAtomicCommit.js";
import { createServiceError } from "../../shared/serviceError.js";

const REASONS = new Set([
  "source_evidence_missing", "financial_mismatch", "ownership_unproven",
  "correspondence_unproven", "other",
]);

function fail(code, status = 409) {
  return createServiceError("Seller order review transition refused.", status, { code });
}

/**
 * Hold or reopen a proposal for further review; no association can be
 * approved here. Review state and audit evidence must commit atomically.
 */
export async function transitionSellerOrderReview(connection, externalOrderId, {
  businessId, locationAccessMode, actorId, action, reason = "",
  requestId = "", linkModel = SellerChannelOrderLink,
  stagedModel = SellerChannelStagingRecord, auditModel = AuditLog,
  startSession = () => mongoose.startSession(),
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(actorId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection.business) !== String(businessId) ||
      connection.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection.provider)) {
    throw fail("SELLER_REVIEW_AUTHORITY_INVALID", 403);
  }
  if (locationAccessMode !== "all") throw fail("SELLER_REVIEW_LOCATION_DENIED", 403);
  if (typeof externalOrderId !== "string" ||
      !/^[A-Za-z0-9!_.-]{1,120}$/.test(externalOrderId)) {
    throw fail("SELLER_REVIEW_EXTERNAL_ID_INVALID", 400);
  }
  if (!["hold", "reopen"].includes(action) ||
      (action === "hold" && !REASONS.has(reason)) ||
      (action === "reopen" && reason !== "") ||
      typeof requestId !== "string" || requestId.length > 120) {
    throw fail("SELLER_REVIEW_ACTION_INVALID", 400);
  }
  const scope = {
    business: businessId, connection: connection._id,
    provider: connection.provider, externalOrderId,
  };
  const stagedScope = {
    business: businessId, connection: connection._id,
    provider: connection.provider, kind: "orders", externalId: externalOrderId,
  };
  const previous = action === "hold" ? "pending_verification" : "reviewed_hold";
  const next = action === "hold" ? "reviewed_hold" : "pending_verification";
  const timestamp = new Date();
  return withSellerAtomicSourceCommit(async (session) => {
    const staged = await stagedModel.findOne(stagedScope).session(session)
      .select("business connection provider kind externalId").lean();
    if (!staged || String(staged.business) !== String(businessId) ||
        String(staged.connection) !== String(connection._id) ||
        staged.provider !== connection.provider || staged.kind !== "orders" ||
        staged.externalId !== externalOrderId) {
      throw fail("SELLER_REVIEW_STAGED_MISSING", 404);
    }
    const update = await linkModel.findOneAndUpdate({
      ...scope, verificationStatus: previous,
      evidenceSource: "operator_proposal",
    }, {
      $set: {
        verificationStatus: next,
        reviewReason: action === "hold" ? reason : "",
        reviewedBy: actorId,
        reviewedAt: timestamp,
      },
    }, {
      new: true, session, runValidators: true,
    }).lean();
    if (!update || String(update.business) !== String(businessId) ||
        String(update.connection) !== String(connection._id) ||
        update.provider !== connection.provider ||
        update.externalOrderId !== externalOrderId ||
        update.verificationStatus !== next) {
      throw fail("SELLER_REVIEW_CONFLICT");
    }
    await auditModel.create([{
      actor: actorId,
      action: action === "hold" ? "seller_order_link_hold" : "seller_order_link_reopen",
      resourceType: "SellerChannelOrderLink",
      resourceId: String(update._id),
      requestId,
      before: { verificationStatus: previous },
      after: { verificationStatus: next },
      metadata: {
        businessId: String(businessId),
        connectionId: String(connection._id),
        provider: connection.provider,
        reason: action === "hold" ? reason : "",
      },
    }], { session });
    return Object.freeze({
      externalOrderId, reviewStatus: next, reason: action === "hold" ? reason : "",
      auditRecorded: true, associationApproved: false,
      canonicalRecordsWritten: 0, fulfillmentWrites: 0,
      refundsIssued: 0, stockUpdatesApplied: 0, productionAccepted: false,
    });
  }, { startSession });
}
