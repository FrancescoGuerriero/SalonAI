import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import SellerChannelImportLease from "../../models/SellerChannelImportLease.js";
import { createServiceError } from "../../shared/serviceError.js";

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * One active import per business/connection/kind. Unique index is required
 * in MongoDB, including production, before activating this feature.
 * The TTL is deliberately longer than a bounded five-page provider read.
 */
export async function withSellerImportLease({
  businessId, connectionId, kind, leaseModel = SellerChannelImportLease,
}, callback) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connectionId) ||
      !["listings", "orders"].includes(kind) ||
      typeof callback !== "function") {
    throw createServiceError("Seller import lease has invalid tenant scope.", 400, {
      code: "SELLER_IMPORT_LEASE_INVALID_SCOPE",
    });
  }
  const owner = randomUUID();
  const filter = { business: businessId, connection: connectionId, kind };
  try {
    await leaseModel.create({
      ...filter, owner, acquiredAt: new Date(), expiresAt: new Date(Date.now() + TEN_MINUTES),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError("Another seller import is already running for this connection.", 409, {
        code: "SELLER_IMPORT_ALREADY_RUNNING",
      });
    }
    throw error;
  }
  // Fencing check: a slow provider read may outlive its TTL. Refresh only
  // this owner's unexpired lease before any staged/checkpoint writes.
  const assertLeaseOwned = async () => {
    const renewed = await leaseModel.findOneAndUpdate({
      ...filter, owner, expiresAt: { $gt: new Date() },
    }, {
      $set: { expiresAt: new Date(Date.now() + TEN_MINUTES) },
    }, { new: true });
    if (!renewed) {
      throw createServiceError("Seller import ownership expired; refuse staging.", 409, {
        code: "SELLER_IMPORT_LEASE_EXPIRED",
      });
    }
  };
  try {
    return await callback(assertLeaseOwned);
  } finally {
    // Ownership predicate prevents a delayed request from releasing
    // a lock belonging to a newer request after TTL cleanup.
    await leaseModel.deleteOne({ ...filter, owner });
  }
}
