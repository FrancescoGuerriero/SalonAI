import { createServiceError } from "../../shared/serviceError.js";

const COLUMNS = Object.freeze([
  ["externalOrderId", "Marketplace Order ID"],
  ["linkStatus", "Link Review State"],
  ["proposedCommerceOrderId", "Proposed Commerce Order ID"],
  ["orderOwnershipVerified", "Commerce Ownership Verified"],
  ["commerceStateCompared", "Commerce State Compared"],
]);

function invalid() {
  return createServiceError("Invalid read-only seller order-link review.", 502, {
    code: "SELLER_ORDER_LINK_EXPORT_INVALID",
  });
}

// Only explicitly reviewed fields are exported. Strip newlines and controls
// before CSV quoting; prevent spreadsheet formula execution from provider IDs.
function csvCell(value) {
  let text = value == null ? "" : String(value);
  text = text.replace(/[\u0000-\u001f\u007f\u2028\u2029]/gu, " ");
  if (/^\s*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function buildSellerOrderLinkReviewCsv(review) {
  if (review?.readOnly !== true || review?.productionAccepted !== false ||
      review?.canonicalOrdersCompared !== false ||
      review?.canonicalRecordsWritten !== 0 || review?.linksWritten !== 0 ||
      review?.stockUpdatesApplied !== 0 ||
      review?.summary?.verified !== 0 ||
      !Array.isArray(review.records) || review.records.length > 50 ||
      review.inspectedCount !== review.records.length ||
      review.source !== "staged_orders_and_explicit_link_proposals") {
    throw invalid();
  }
  const lines = [COLUMNS.map(([, title]) => csvCell(title)).join(",")];
  for (const record of review.records) {
    if (!record || typeof record.externalOrderId !== "string" ||
        !record.externalOrderId.trim() || record.externalOrderId.length > 200 ||
        !["unlinked", "proposal_pending_verification"].includes(record.linkStatus) ||
        record.orderOwnershipVerified !== false ||
        record.commerceStateCompared !== false ||
        (record.linkStatus === "unlinked" && record.proposedCommerceOrderId !== null) ||
        (record.linkStatus === "proposal_pending_verification" &&
          !/^[0-9a-fA-F]{24}$/.test(record.proposedCommerceOrderId || ""))) {
      throw invalid();
    }
    lines.push(COLUMNS.map(([key]) => csvCell(record[key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
