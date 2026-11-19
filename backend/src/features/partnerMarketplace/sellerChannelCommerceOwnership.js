import mongoose from "mongoose";
import Order from "../commerce/Order.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import SellerChannelOrderLink from "../../models/SellerChannelOrderLink.js";
import { inspectSellerOrderSourceEvidence } from "./sellerChannelOrderEvidence.js";
import { createServiceError } from "../../shared/serviceError.js";

const failure = (message, code, status = 409) =>
  createServiceError(message, status, { code });

const validId = (value) => mongoose.isValidObjectId(value);

/**
 * One explicit, unapproved proposal at a time. The Commerce query is scoped
 * to an ORDER that already bears the trusted business ID. Legacy orders
 * lacking business ownership are ineligible. No write or approval occurs.
 */
export async function inspectSellerCommerceOrderOwnership(connection, externalOrderId, {
  businessId, locationAccessMode,
  stagedModel = SellerChannelStagingRecord,
  linkModel = SellerChannelOrderLink,
  orderModel = Order,
} = {}) {
  if (!validId(businessId) || !validId(connection?._id) ||
      String(connection.business) !== String(businessId) ||
      connection.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection.provider)) {
    throw failure("Trusted seller connection required.", "SELLER_ORDER_OWNERSHIP_AUTHORITY", 403);
  }
  if (locationAccessMode !== "all") {
    throw failure("Business-wide seller authority required.", "SELLER_ORDER_OWNERSHIP_SCOPE", 403);
  }
  if (typeof externalOrderId !== "string" ||
      !/^[a-zA-Z0-9!_.-]{1,120}$/.test(externalOrderId)) {
    throw failure("Invalid external order reference.", "SELLER_ORDER_OWNERSHIP_REFERENCE", 400);
  }
  const scope = { business: businessId, connection: connection._id,
    provider: connection.provider, externalId: externalOrderId, kind: "orders" };
  const staged = await stagedModel.findOne(scope)
    .select("business connection provider kind externalId sourceRecord").lean();
  if (!staged || String(staged.business) !== String(businessId) ||
      String(staged.connection) !== String(connection._id) ||
      staged.provider !== connection.provider || staged.kind !== "orders" ||
      staged.externalId !== externalOrderId) {
    throw failure("Trusted staged order evidence unavailable.",
      "SELLER_ORDER_OWNERSHIP_STAGED_MISSING", 404);
  }
  const link = await linkModel.findOne({
    business: businessId, connection: connection._id, provider: connection.provider,
    externalOrderId,
  }).select("business connection provider externalOrderId commerceOrder verificationStatus evidenceSource").lean();
  if (!link || String(link.business) !== String(businessId) ||
      String(link.connection) !== String(connection._id) ||
      link.provider !== connection.provider || link.externalOrderId !== externalOrderId ||
      !validId(link.commerceOrder) || link.verificationStatus !== "pending_verification" ||
      link.evidenceSource !== "operator_proposal") {
    throw failure("A valid pending Commerce proposal is required.",
      "SELLER_ORDER_OWNERSHIP_PROPOSAL_REQUIRED", 409);
  }
  // Never query by order ID alone. Missing owner field is a hard mismatch.
  const order = await orderModel.findOne({
    _id: link.commerceOrder, business: businessId,
  }).select("_id business total currency status").lean();
  const owned = !!order && String(order.business) === String(businessId) &&
    String(order._id) === String(link.commerceOrder);
  if (order && !owned) {
    throw failure("Inconsistent Commerce ownership evidence.",
      "SELLER_ORDER_OWNERSHIP_INVALID_EVIDENCE", 502);
  }
  const source = inspectSellerOrderSourceEvidence(staged.sourceRecord);
  const localCurrency = owned && typeof order.currency === "string" ?
    order.currency.toUpperCase() : null;
  const cents = owned && typeof order.total === "number" && order.total >= 0 &&
    Number.isFinite(order.total) && Number.isSafeInteger(Math.round(order.total * 100)) &&
    Math.abs(order.total * 100 - Math.round(order.total * 100)) < 0.000001 ?
      Math.round(order.total * 100) : null;
  const sourceCents = source.state === "source_evidence_present" &&
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(source.sourceAmount || "") ?
      (() => {
        const [major, fraction = ""] = source.sourceAmount.split(".");
        return Number(major) * 100 + Number(fraction.padEnd(2, "0"));
      })() : null;
  const amountComparable = cents !== null && Number.isSafeInteger(sourceCents) &&
    source.sourceCurrency === localCurrency;
  const amountMatches = amountComparable && sourceCents === cents;
  return Object.freeze({
    externalOrderId, proposedCommerceOrderId: String(link.commerceOrder),
    status: !owned ? "commerce_ownership_unverified" :
      source.state !== "source_evidence_present" || !amountComparable ?
        "financial_evidence_incomplete" :
        !amountMatches ? "financial_evidence_disagrees" : "requires_operator_correspondence_review",
    commerceBusinessOwnershipConfirmed: owned,
    financialEvidenceComparable: amountComparable,
    financialEvidenceMatches: amountMatches,
    sourceEvidenceState: source.state,
    orderCorrespondenceVerified: false,
    associationApproved: false,
    canonicalRecordsWritten: 0,
    linksWritten: 0,
    stockUpdatesApplied: 0,
    productionAccepted: false,
    readOnly: true,
  });
}
