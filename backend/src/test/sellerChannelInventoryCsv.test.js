import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildSellerInventoryReviewCsv } from "../features/partnerMarketplace/sellerChannelInventoryCsv.js";

const report = (records) => ({
  kind: "listings", comparisonMode: "dry_run_only",
  canonicalRecordsWritten: 0, stockUpdatesApplied: 0,
  marketplaceLocationMappingVerified: false, quantityComparisonAccepted: false,
  records: records.map((row) => row === null ? row : ({
    marketplaceLocationMappingVerified: false,
    quantityComparisonAccepted: false, ...row,
  })),
});

test("seller inventory exports unmapped candidate observations without stock deltas", () => {
  const csv = buildSellerInventoryReviewCsv(report([
    { sku: "SKU, ONE", externalId: 'A"1',
      state: "marketplace_location_mapping_required",
      marketplaceQuantity: 8, canonicalQuantity: null, quantityDifference: null,
      canonicalProductId: null },
    { sku: "MISSING", externalId: "none", state: "no_canonical_product",
      marketplaceQuantity: null, canonicalQuantity: null, quantityDifference: null },
  ]));
  assert.match(csv, /"SKU, ONE","A""1","marketplace_location_mapping_required","8","",""/);
  assert.ok(csv.includes('"Marketplace Location Mapping Verified"'));
  assert.ok(csv.includes('"Quantity Comparison Accepted"'));
  assert.ok(csv.includes('"false","false"'));
  assert.match(csv, /"MISSING","none","no_canonical_product","","",""/);
  assert.equal(csv.split("\r\n").length, 4);
  assert.ok(!csv.includes("undefined"));
});

test("marketplace identifiers cannot inject spreadsheet formulas or CSV rows", () => {
  for (const value of ["=HYPERLINK(\"https://bad.invalid\")", "+SUM(1,2)",
    "@IMPORT", "-cmd", " \t=1+1", "item\r\nnew"]) {
    const csv = buildSellerInventoryReviewCsv(report([
      { sku: value, externalId: "source", state: "quantity_not_comparable" },
    ]));
    if (!value.includes("\r\n")) {
      assert.match(csv.split("\r\n")[1], /^"'|^"item/);
    } else {
      assert.ok(csv.includes('"item\r\nnew"'));
    }
  }
});

test("inventory export rejects non-readonly, overly large and malformed previews", () => {
  for (const bad of [
    { ...report([]), comparisonMode: "write_back" },
    { ...report([]), stockUpdatesApplied: 1 },
    { ...report([]), canonicalRecordsWritten: 1 },
    { ...report([]), records: Array.from({ length: 51 }, () => ({})) },
    { ...report([]), records: null },
    { ...report([]), kind: "orders" },
    report([null]),
    { ...report([]), marketplaceLocationMappingVerified: true },
    { ...report([]), quantityComparisonAccepted: true },
    report([{ sku: "ONE", state: "quantity_differs", quantityDifference: 3 }]),
    report([{ sku: "ONE", state: "marketplace_location_mapping_required",
      canonicalQuantity: 5 }]),
    report([{ sku: "ONE", state: "marketplace_location_mapping_required",
      canonicalProductId: "507f1f77bcf86cd799439027" }]),
    report([{ sku: "ONE", state: "marketplace_location_mapping_required",
      marketplaceLocationMappingVerified: true }]),
    report([{ sku: "ONE", state: "matched" }]),
  ]) {
    assert.throws(() => buildSellerInventoryReviewCsv(bad),
      (error) => error.details?.code === "SELLER_INVENTORY_EXPORT_INVALID");
  }
});

test("CSV export route applies existing inventory and product permissions", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/reconciliation-export", requirePermissions\("inventory:read"\),\s*requirePermissions\("product:read"\), requireSellerTenantWideLocation/);
  assert.match(routes, /buildSellerInventoryReviewCsv\(preview\)/);
  assert.match(routes, /"private, no-store"/);
});
