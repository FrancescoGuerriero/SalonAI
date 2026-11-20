import { createServiceError } from "../../shared/serviceError.js";

const COLUMNS = Object.freeze([
  ["sku", "SKU"],
  ["externalId", "Marketplace Reference"],
  ["state", "Review State"],
  ["marketplaceQuantity", "Marketplace Quantity"],
  ["canonicalQuantity", "Commerce Quantity"],
  ["quantityDifference", "Quantity Difference"],
  ["canonicalProductId", "Commerce Product ID"],
]);

// CSV is intended for spreadsheet review, not for importing stock updates.
// Prevent spreadsheet formula execution even when external SKUs are malicious.
function cell(value) {
  let result = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/u.test(result) && !/^-?\d+(?:\.\d+)?$/.test(result)) {
    result = "'" + result;
  }
  return '"' + result.replaceAll('"', '""') + '"';
}

export function buildSellerInventoryReviewCsv(preview) {
  if (preview?.comparisonMode !== "dry_run_only" ||
      preview?.canonicalRecordsWritten !== 0 ||
      preview?.stockUpdatesApplied !== 0 ||
      !Array.isArray(preview.records) || preview.records.length > 50 ||
      preview?.kind !== "listings") {
    throw createServiceError("Invalid read-only seller inventory preview.", 502, {
      code: "SELLER_INVENTORY_EXPORT_INVALID",
    });
  }
  const lines = [COLUMNS.map(([, title]) => cell(title)).join(",")];
  for (const record of preview.records) {
    if (!record || typeof record !== "object") {
      throw createServiceError("Invalid seller inventory row.", 502, {
        code: "SELLER_INVENTORY_EXPORT_INVALID",
      });
    }
    lines.push(COLUMNS.map(([field]) => cell(record[field])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
