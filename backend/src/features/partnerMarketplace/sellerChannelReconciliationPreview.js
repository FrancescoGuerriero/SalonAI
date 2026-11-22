import mongoose from "mongoose";
import Product from "../commerce/Product.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Dry-run SKU reconciliation: staging vs canonical Commerce Product.
 * Never infers location stock, publishes listings, or writes Commerce.
 */
export async function previewSellerChannelInventory(connection, {
  businessId, locationId = null, stagedModel = SellerChannelStagingRecord,
  productModel = Product, limit = 50,
} = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
    !mongoose.isValidObjectId(connection?._id) ||
    String(connection?.business) !== String(businessId) ||
    connection?.status !== "connected" ||
    !["amazon_seller_central", "ebay"].includes(connection?.provider)) {
    throw createServiceError("Trusted connected seller tenant authority is required.", 403);
  }
  // Product stock is location-bound; never compare it to a cross-location
  // marketplace count unless an explicit trusted location is provided.
  if (locationId !== null && !mongoose.isValidObjectId(locationId)) {
    throw createServiceError("A valid location is required.", 400);
  }
  const count = Number.isSafeInteger(Number(limit)) ? Math.min(50, Math.max(1, Number(limit))) : 50;
  const staged = await stagedModel.find({
    business: businessId, connection: connection._id,
    provider: connection.provider, kind: "listings",
  }).sort({ lastObservedAt: -1, _id: -1 }).limit(count).lean();
  if (!Array.isArray(staged) || staged.length > count) {
    throw createServiceError("Unexpected staged inventory response.", 502, {
      code: "SELLER_INVENTORY_STAGED_EVIDENCE_INVALID",
    });
  }

  // A filtered query is not sufficient evidence of tenant ownership.
  // Validate every returned record before comparing canonical quantities.
  const seenExternalIds = new Set();
  for (const row of staged) {
    const externalId = row?.externalId;
    if (String(row?.business) !== String(businessId) ||
        String(row?.connection) !== String(connection._id) ||
        row?.provider !== connection.provider || row?.kind !== "listings" ||
        typeof externalId !== "string" || !externalId.trim() ||
        externalId.length > 200 || seenExternalIds.has(externalId) ||
        !row.sourceRecord || typeof row.sourceRecord !== "object" ||
        Array.isArray(row.sourceRecord)) {
      throw createServiceError("Inconsistent staged seller inventory evidence.", 502, {
        code: "SELLER_INVENTORY_STAGED_EVIDENCE_INVALID",
      });
    }
    seenExternalIds.add(externalId);
  }

  const rawSkus = staged.map((row) => String(row.sourceRecord.sku || "").trim());
  const normalizedSkus = rawSkus.map((sku) => sku.toUpperCase());
  const skus = [...new Set(normalizedSkus.filter(Boolean))];
  const skuCounts = new Map();
  for (const sku of normalizedSkus) {
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
  }
  const canonical = skus.length ? await productModel.find({
    business: businessId, sku: { $in: skus },
  }).select("sku stockQuantity location").lean() : [];
  if (!Array.isArray(canonical)) {
    throw createServiceError("Unexpected Commerce inventory response.", 502, {
      code: "SELLER_INVENTORY_COMMERCE_EVIDENCE_INVALID",
    });
  }
  const bySku = new Map();
  for (const product of canonical) {
    const sku = typeof product?.sku === "string" ?
      product.sku.trim().toUpperCase() : "";
    if (String(product?.business) !== String(businessId) ||
        !sku || !skus.includes(sku)) {
      throw createServiceError("Inconsistent Commerce inventory evidence.", 502, {
        code: "SELLER_INVENTORY_COMMERCE_EVIDENCE_INVALID",
      });
    }
    const rows = bySku.get(sku) || [];
    rows.push(product);
    bySku.set(sku, rows);
  }
  const rows = staged.map((row) => {
    const sku = String(row.sourceRecord?.sku || "").trim().toUpperCase();
    const matching = bySku.get(sku) || [];
    const exact = locationId === null ? matching : matching.filter((product) =>
      String(product.location || "") === String(locationId));
    const remote = row.sourceRecord?.quantity;
    const local = exact.length === 1 ? exact[0].stockQuantity : null;
    const comparable = (skuCounts.get(sku) || 0) === 1 &&
      locationId !== null && exact.length === 1 &&
      Number.isSafeInteger(remote) && Number.isSafeInteger(local) &&
      remote >= 0 && local >= 0;
    if (comparable && !mongoose.isValidObjectId(exact[0]._id)) {
      throw createServiceError("Missing canonical product identity.", 502, {
        code: "SELLER_INVENTORY_COMMERCE_EVIDENCE_INVALID",
      });
    }
    return Object.freeze({
      sku, externalId: String(row.externalId || ""),
      state: !sku ? "invalid_staged_sku" :
        (skuCounts.get(sku) || 0) > 1 ? "ambiguous_staged_sku" :
        !matching.length ? "no_canonical_product" :
          locationId === null ? "location_selection_required" :
            !exact.length ? "no_product_for_location" :
              exact.length > 1 ? "ambiguous_product_match" :
                !comparable ? "quantity_not_comparable" :
                  remote === local ? "matched" : "quantity_differs",
      marketplaceQuantity: Number.isSafeInteger(remote) ? remote : null,
      canonicalQuantity: comparable ? local : null,
      quantityDifference: comparable ? remote - local : null,
      canonicalProductId: comparable ? String(exact[0]._id) : null,
    });
  });
  // Summarise only examined rows. A capped preview is never evidence that
  // the full marketplace catalogue has been reconciled.
  const counts = Object.create(null);
  for (const record of rows) {
    counts[record.state] = (counts[record.state] || 0) + 1;
  }
  const summary = Object.freeze({
    matched: counts.matched || 0,
    quantityDiffers: counts.quantity_differs || 0,
    unresolved: rows.length - (counts.matched || 0) - (counts.quantity_differs || 0),
    potentialStockChanges: 0,
    examinedRowsOnly: true,
    possiblyTruncated: staged.length === count,
  });
  return Object.freeze({
    businessId: String(businessId), connectionId: String(connection._id),
    locationSelected: locationId !== null,
    kind: "listings", comparisonMode: "dry_run_only",
    records: Object.freeze(rows), reviewedCount: rows.length,
    summary,
    canonicalRecordsWritten: 0, stockUpdatesApplied: 0,
    productionAccepted: false,
  });
}
