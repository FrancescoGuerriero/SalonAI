import { createServiceError } from "../../shared/serviceError.js";

const COLUMNS = Object.freeze([
  ["sku", "SKU"],
  ["externalId", "Marketplace Reference"],
  ["state", "Review State"],
  ["marketplaceQuantity", "Marketplace Quantity"],
  ["canonicalQuantity", "Commerce Quantity"],
  ["quantityDifference", "Quantity Difference"],
  ["canonicalProductId", "Commerce Product ID"],
  ["marketplaceLocationMappingVerified", "Marketplace Location Mapping Verified"],
  ["quantityComparisonAccepted", "Quantity Comparison Accepted"],
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
      preview?.marketplaceLocationMappingVerified !== false ||
      preview?.quantityComparisonAccepted !== false ||
      !Array.isArray(preview.records) || preview.records.length > 50 ||
      preview?.kind !== "listings") {
    throw createServiceError("Invalid read-only seller inventory preview.", 502, {
      code: "SELLER_INVENTORY_EXPORT_INVALID",
    });
  }
  const lines = [COLUMNS.map(([, title]) => cell(title)).join(",")];
  for (const record of preview.records) {
    if (!record || typeof record !== "object" ||
        record.marketplaceLocationMappingVerified !== false ||
        record.quantityComparisonAccepted !== false ||
        record.quantityDifference != null || record.canonicalQuantity != null ||
        record.canonicalProductId != null ||
        !["invalid_staged_sku", "ambiguous_staged_sku", "no_canonical_product",
          "location_selection_required", "no_product_for_location",
          "ambiguous_product_match", "quantity_not_comparable",
          "marketplace_location_mapping_required"].includes(record.state)) {
      throw createServiceError("Invalid seller inventory row.", 502, {
        code: "SELLER_INVENTORY_EXPORT_INVALID",
      });
    }
    lines.push(COLUMNS.map(([field]) => cell(record[field])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
