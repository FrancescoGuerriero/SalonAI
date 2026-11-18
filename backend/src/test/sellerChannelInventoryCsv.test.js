import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildSellerInventoryReviewCsv } from "../features/partnerMarketplace/sellerChannelInventoryCsv.js";

const report = (records) => ({
  kind: "listings", comparisonMode: "dry_run_only",
  canonicalRecordsWritten: 0, stockUpdatesApplied: 0, records,
});

test("seller inventory exports verified dry-run quantities and escapes CSV correctly", () => {
  const csv = buildSellerInventoryReviewCsv(report([
    { sku: "SKU, ONE", externalId: 'A"1', state: "quantity_differs",
      marketplaceQuantity: 8, canonicalQuantity: 6, quantityDifference: 2,
      canonicalProductId: "507f1f77bcf86cd799439027" },
    { sku: "MISSING", externalId: "none", state: "no_canonical_product",
      marketplaceQuantity: null, canonicalQuantity: null, quantityDifference: null },
  ]));
  assert.match(csv, /"SKU, ONE","A""1","quantity_differs","8","6","2"/);
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
