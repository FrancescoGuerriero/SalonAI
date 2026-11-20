import { inspectSellerChannelOrderLinks } from "./sellerChannelOrderLinkInspection.js";
import { inspectSellerCommerceOrderOwnership } from "./sellerChannelCommerceOwnership.js";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Operator-side batch preflight. Never approves associations and never
 * executes Commerce, refund, fulfilment or inventory writes.
 */
export async function inspectSellerCommerceOrderBatch(connection, {
  businessId, locationAccessMode, limit = 10,
  inspectLinks = inspectSellerChannelOrderLinks,
  inspectOwnership = inspectSellerCommerceOrderOwnership,
} = {}) {
  const take = Number(limit);
  if (!Number.isInteger(take) || take < 1 || take > 10) {
    throw createServiceError("Order ownership batch limit must be 1-10.", 400, {
      code: "SELLER_ORDER_BATCH_LIMIT_INVALID",
    });
  }
  // The existing inspector enforces connected provider, trusted business and
  // unrestricted business-wide membership before any source records are read.
  const review = await inspectLinks(connection, {
    businessId, locationAccessMode, limit: take,
  });
  if (review?.readOnly !== true || review?.canonicalOrdersCompared !== false ||
      review?.linksWritten !== 0 || review?.canonicalRecordsWritten !== 0 ||
      !Array.isArray(review.records) || review.records.length > take ||
      review.inspectedCount !== review.records.length) {
    throw createServiceError("Untrusted seller order link review.", 502, {
      code: "SELLER_ORDER_BATCH_EVIDENCE_INVALID",
    });
  }
  const result = [];
  let proposed = 0;
  let held = 0;
  for (const row of review.records) {
    if (!row || typeof row.externalOrderId !== "string" ||
        !["unlinked", "proposal_pending_verification", "reviewed_hold"].includes(row.linkStatus) ||
        row.orderOwnershipVerified !== false ||
        row.commerceStateCompared !== false) {
      throw createServiceError("Invalid seller order link row.", 502, {
        code: "SELLER_ORDER_BATCH_EVIDENCE_INVALID",
      });
    }
    if (row.linkStatus === "unlinked") {
      result.push(Object.freeze({
        externalOrderId: row.externalOrderId,
        status: "unlinked",
        commerceBusinessOwnershipConfirmed: false,
        financialEvidenceMatches: false,
        associationApproved: false,
      }));
      continue;
    }
    if (row.linkStatus === "reviewed_hold") {
      if (!["source_evidence_missing", "financial_mismatch", "ownership_unproven",
        "correspondence_unproven", "other"].includes(row.reviewReason) ||
        !/^[0-9a-fA-F]{24}$/.test(row.proposedCommerceOrderId || "")) {
        throw createServiceError("Invalid held order proposal.", 502, {
          code: "SELLER_ORDER_BATCH_EVIDENCE_INVALID",
        });
      }
      held++;
      result.push(Object.freeze({
        externalOrderId: row.externalOrderId, status: "reviewed_hold",
        commerceBusinessOwnershipConfirmed: false,
        financialEvidenceMatches: false, associationApproved: false,
      }));
      continue;
    }
    proposed++;
    const inspection = await inspectOwnership(connection, row.externalOrderId, {
      businessId, locationAccessMode,
    });
    if (inspection?.externalOrderId !== row.externalOrderId ||
        inspection?.proposedCommerceOrderId !== row.proposedCommerceOrderId ||
        inspection?.associationApproved !== false ||
        inspection?.orderCorrespondenceVerified !== false ||
        inspection?.canonicalRecordsWritten !== 0 ||
        inspection?.linksWritten !== 0 ||
        inspection?.readOnly !== true) {
      throw createServiceError("Inconsistent Commerce order ownership review.", 502, {
        code: "SELLER_ORDER_BATCH_EVIDENCE_INVALID",
      });
    }
    result.push(Object.freeze({
      externalOrderId: row.externalOrderId,
      status: inspection.status,
      commerceBusinessOwnershipConfirmed: inspection.commerceBusinessOwnershipConfirmed,
      financialEvidenceMatches: inspection.financialEvidenceMatches,
      associationApproved: false,
    }));
  }
  return Object.freeze({
    provider: connection.provider, kind: "order_ownership_batch",
    records: Object.freeze(result), inspectedCount: result.length,
    summary: Object.freeze({
      unlinked: result.length - proposed - held,
      reviewedHold: held,
      proposalsInspected: proposed,
      approved: 0,
      possiblyTruncated: review.summary?.possiblyTruncated === true,
    }),
    readOnly: true, associationApproved: false,
    canonicalRecordsWritten: 0, linksWritten: 0,
    stockUpdatesApplied: 0, productionAccepted: false,
  });
}
