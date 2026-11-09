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
    String(connection?.business) !== String(businessId) ||
    connection.status !== "connected") {
    throw createServiceError("Trusted connected seller tenant authority is required.", 403);
  }
  // Product stock is location-bound; never compare it to a cross-location
  // marketplace count unless an explicit trusted location is provided.
  if (locationId !== null && !mongoose.isValidObjectId(locationId)) {
    throw createServiceError("A valid location is required.", 400);
  }
  const count = Number.isSafeInteger(Number(limit)) ? Math.min(50, Math.max(1, Number(limit))) : 50;
  const staged = await stagedModel.find({
    business: businessId, connection: connection._id, kind: "listings",
  }).sort({ lastObservedAt: -1, _id: -1 }).limit(count).lean();
  if (!Array.isArray(staged)) throw createServiceError("Unexpected staged inventory response.", 502);

  const rawSkus = staged.map((row) => String(row.sourceRecord?.sku || "").trim());
  const skus = [...new Set(rawSkus.map((sku) => sku.toUpperCase()).filter(Boolean))];
  const canonical = skus.length ? await productModel.find({
    business: businessId, sku: { $in: skus },
  }).select("sku stockQuantity location").lean() : [];
  if (!Array.isArray(canonical)) throw createServiceError("Unexpected Commerce inventory response.", 502);
  const bySku = new Map();
  for (const product of canonical) {
    const sku = String(product.sku || "").toUpperCase();
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
    const comparable = locationId !== null && exact.length === 1 &&
      Number.isSafeInteger(remote) && Number.isSafeInteger(local) &&
      remote >= 0 && local >= 0;
    return Object.freeze({
      sku, externalId: String(row.externalId || ""),
      state: !sku ? "invalid_staged_sku" :
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
  return Object.freeze({
    businessId: String(businessId), connectionId: String(connection._id),
    locationSelected: locationId !== null,
    kind: "listings", comparisonMode: "dry_run_only",
    records: Object.freeze(rows), reviewedCount: rows.length,
    canonicalRecordsWritten: 0, stockUpdatesApplied: 0,
    productionAccepted: false,
  });
}
