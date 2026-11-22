import mongoose from "mongoose";
import Order from "../commerce/Order.js";
import SellerChannelOrderLink from "../../models/SellerChannelOrderLink.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import AuditLog from "../../models/AuditLog.js";
import { withSellerAtomicSourceCommit } from "./sellerChannelAtomicCommit.js";
import { createServiceError } from "../../shared/serviceError.js";

function reject(code, status = 409) {
  return createServiceError("Seller order association proposal refused.", status, { code });
}

/**
 * An operator may propose an explicitly identified association, never verify
 * or approve it. Both source and destination ownership are rechecked inside
 * one MongoDB transaction. Unique indexes reject duplicate proposals.
 */
export async function proposeSellerCommerceOrderLink(connection, externalOrderId, {
  businessId, locationAccessMode, actorId, commerceOrderId, requestId = "",
  stagedModel = SellerChannelStagingRecord, orderModel = Order,
  linkModel = SellerChannelOrderLink, auditModel = AuditLog,
  startSession = () => mongoose.startSession(),
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      !mongoose.isValidObjectId(actorId) ||
      String(connection.business) !== String(businessId) ||
      connection.status !== "connected" ||
      !["ebay", "amazon_seller_central"].includes(connection.provider)) {
    throw reject("SELLER_PROPOSAL_AUTHORITY_REQUIRED", 403);
  }
  if (locationAccessMode !== "all") throw reject("SELLER_PROPOSAL_SCOPE_REQUIRED", 403);
  if (typeof externalOrderId !== "string" ||
      !/^[A-Za-z0-9!_.-]{1,120}$/.test(externalOrderId) ||
      !mongoose.isValidObjectId(commerceOrderId) ||
      typeof requestId !== "string" || requestId.length > 120) {
    throw reject("SELLER_PROPOSAL_INPUT_INVALID", 400);
  }
  return withSellerAtomicSourceCommit(async (session) => {
    const staged = await stagedModel.findOne({
      business: businessId, connection: connection._id, provider: connection.provider,
      kind: "orders", externalId: externalOrderId,
    }).session(session).select("business connection provider kind externalId").lean();
    if (!staged || String(staged.business) !== String(businessId) ||
        String(staged.connection) !== String(connection._id) ||
        staged.provider !== connection.provider || staged.kind !== "orders" ||
        staged.externalId !== externalOrderId) {
      throw reject("SELLER_PROPOSAL_STAGED_MISSING", 404);
    }
    const order = await orderModel.findOne({
      _id: commerceOrderId, business: businessId,
    }).session(session).select("_id business").lean();
    if (!order || String(order._id) !== String(commerceOrderId) ||
        String(order.business) !== String(businessId)) {
      throw reject("SELLER_PROPOSAL_COMMERCE_OWNERSHIP_UNVERIFIED", 409);
    }
    const existing = await linkModel.findOne({
      business: businessId, $or: [
        { connection: connection._id, externalOrderId },
        { commerceOrder: commerceOrderId },
      ],
    }).session(session).select("_id").lean();
    if (existing) throw reject("SELLER_PROPOSAL_CONFLICT");
    let proposal;
    try {
      [proposal] = await linkModel.create([{
        business: businessId, connection: connection._id, provider: connection.provider,
        externalOrderId, commerceOrder: commerceOrderId,
        verificationStatus: "pending_verification",
        evidenceSource: "operator_proposal",
      }], { session });
    } catch (error) {
      if (error?.code === 11000) throw reject("SELLER_PROPOSAL_CONFLICT");
      throw error;
    }
    await auditModel.create([{
      actor: actorId, action: "seller_order_link_proposed",
      resourceType: "SellerChannelOrderLink", resourceId: String(proposal._id),
      requestId, before: null,
      after: { verificationStatus: "pending_verification" },
      metadata: {
        businessId: String(businessId), connectionId: String(connection._id),
        provider: connection.provider,
      },
    }], { session });
    return Object.freeze({
      externalOrderId, proposedCommerceOrderId: String(commerceOrderId),
      reviewStatus: "pending_verification", associationApproved: false,
      orderCorrespondenceVerified: false, auditRecorded: true,
      canonicalRecordsWritten: 0, fulfillmentWrites: 0,
      refundsIssued: 0, stockUpdatesApplied: 0, productionAccepted: false,
    });
  }, { startSession });
}
