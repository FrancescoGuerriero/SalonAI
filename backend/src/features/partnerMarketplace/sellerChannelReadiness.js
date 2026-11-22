import mongoose from "mongoose";
import { fetchSellerChannelSnapshot } from "./sellerChannelAdapter.js";
import { createServiceError } from "../../shared/serviceError.js";

const READ_KINDS = Object.freeze(["listings", "orders"]);
const DENIED_WRITES = Object.freeze([
  "listing_publication", "inventory_writeback", "commerce_order_ingestion",
  "order_association_approval", "fulfillment_writeback", "returns_and_refunds",
]);
function fail(code, status = 403) {
  return createServiceError("Seller account diagnostic denied.", status, { code });
}
function validConnection(connection, businessId, locationAccessMode) {
  if (!mongoose.isValidObjectId(businessId) ||
      !mongoose.isValidObjectId(connection?._id) ||
      String(connection.business) !== String(businessId) ||
      connection.status !== "connected" ||
      !["amazon_seller_central", "ebay"].includes(connection.provider)) {
    throw fail("SELLER_DIAGNOSTIC_AUTHORITY_INVALID");
  }
  if (locationAccessMode !== "all") {
    throw fail("SELLER_DIAGNOSTIC_SCOPE_INVALID");
  }
}

/**
 * Performs bounded, live read calls only. Does not expose credentials,
 * raw provider bodies, URLs or buyer details. A successful diagnostic proves
 * read access at that instant, not production acceptance or write authority.
 */
export async function inspectSellerConnectionReadiness(connection, {
  businessId, locationAccessMode,
  fetchSnapshot = fetchSellerChannelSnapshot,
} = {}) {
  validConnection(connection, businessId, locationAccessMode);
  const checks = [];
  for (const kind of READ_KINDS) {
    try {
      const result = await fetchSnapshot(connection, kind, { limit: 1 });
      if (result?.source !== "read_only_provider_snapshot" ||
          result?.kind !== kind ||
          result?.canonicalRecordsWritten !== 0 ||
          result?.ordersFulfilled !== 0 ||
          result?.returnsProcessed !== 0 ||
          result?.publicationEnabled !== false ||
          !Number.isInteger(result?.recordCount) ||
          result.recordCount < 0 || result.recordCount > 1 ||
          !Array.isArray(result?.records) ||
          result.records.length !== result.recordCount) {
        throw fail("SELLER_DIAGNOSTIC_RESPONSE_INVALID", 502);
      }
      checks.push(Object.freeze({
        kind, status: "read_access_confirmed",
        recordsSampled: result.recordCount,
        paginationRemaining: result.nextPageAvailable === true,
      }));
    } catch (error) {
      // Do not return provider errors or body text. Privately retaining a stable
      // application code allows the operator to troubleshoot safely.
      checks.push(Object.freeze({
        kind, status: "read_access_unconfirmed",
        errorCode: typeof error?.details?.code === "string" ?
          error.details.code : "SELLER_DIAGNOSTIC_CHECK_FAILED",
      }));
    }
  }
  return Object.freeze({
    businessId: String(businessId),
    connectionId: String(connection._id),
    provider: connection.provider,
    checkedAt: new Date().toISOString(),
    checks: Object.freeze(checks),
    allReadChecksPassed: checks.every((check) => check.status === "read_access_confirmed"),
    unacceptedWriteCapabilities: DENIED_WRITES,
    writeOperationsEnabled: false,
    productionAccepted: false,
    canonicalRecordsWritten: 0,
  });
}
