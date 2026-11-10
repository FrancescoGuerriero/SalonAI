import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { previewSellerChannelInventory } from "../features/partnerMarketplace/sellerChannelReconciliationPreview.js";

const businessId = "507f1f77bcf86cd799439021";
const foreign = "507f1f77bcf86cd799439022";
const locationId = "507f1f77bcf86cd799439023";
const connection = { _id: "507f1f77bcf86cd799439025", business: businessId, status: "connected" };

function fixture(staged = [], canonical = []) {
  const queries = { staged: [], products: [] };
  const stagedModel = {
    find: (query) => {
      queries.staged.push(query);
      return { sort: () => ({ limit: () => ({ lean: async () => staged }) }) };
    },
  };
  const productModel = {
    find: (query) => {
      queries.products.push(query);
      return { select: () => ({ lean: async () => canonical }) };
    },
  };
  return { stagedModel, productModel, queries };
}

test("seller SKU comparison is dry-run and location-scoped with no inventory writes", async () => {
  const f = fixture([
    { externalId: "SKU-01", sourceRecord: { sku: "SKU-01", quantity: 6 } },
  ], [{ _id: "507f1f77bcf86cd799439027", sku: "SKU-01", location: locationId, stockQuantity: 3 }]);
  const result = await previewSellerChannelInventory(connection, {
    businessId, locationId, ...f,
  });
  assert.equal(result.records[0].state, "quantity_differs");
  assert.equal(result.records[0].quantityDifference, 3);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(result.comparisonMode, "dry_run_only");
  assert.equal(f.queries.products[0].business, businessId);
  assert.deepEqual(f.queries.products[0].sku.$in, ["SKU-01"]);
  assert.equal(f.queries.staged[0].connection, connection._id);
});

test("missing trusted location blocks numeric stock comparison, not source discovery", async () => {
  const f = fixture([{ externalId: "SKU-01", sourceRecord: { sku: "SKU-01", quantity: 6 } }],
    [{ _id: "507f1f77bcf86cd799439027", sku: "SKU-01", location: locationId, stockQuantity: 3 }]);
  const result = await previewSellerChannelInventory(connection, { businessId, ...f });
  assert.equal(result.records[0].state, "location_selection_required");
  assert.equal(result.records[0].canonicalQuantity, null);
  assert.equal(result.records[0].quantityDifference, null);
});

test("foreign tenant, disconnected account and malformed location fail closed", async () => {
  const f = fixture();
  await assert.rejects(previewSellerChannelInventory(connection, { businessId: foreign, ...f }));
  await assert.rejects(previewSellerChannelInventory({ ...connection, status: "degraded" }, { businessId, ...f }));
  await assert.rejects(previewSellerChannelInventory(connection, { businessId, locationId: "invalid", ...f }));
  assert.equal(f.queries.staged.length, 0);
});

test("ambiguity and absent SKU are surfaced, never automatically mapped", async () => {
  const product = { sku: "DUP", location: locationId, stockQuantity: 2 };
  const f = fixture([
    { externalId: "DUP", sourceRecord: { sku: "DUP", quantity: 4 } },
    { externalId: "NEW", sourceRecord: { sku: "NEW", quantity: 1 } },
    { externalId: "EMPTY", sourceRecord: { sku: "", quantity: 1 } },
  ], [product, { ...product, stockQuantity: 7 }]);
  const result = await previewSellerChannelInventory(connection, { businessId, locationId, ...f });
  assert.deepEqual(result.records.map((row) => row.state), [
    "ambiguous_product_match", "no_canonical_product", "invalid_staged_sku",
  ]);
  assert.ok(result.records.every((row) => row.canonicalProductId === null));
});

test("dry-run endpoint is trusted-tenant scoped and never updates Commerce Product", async () => {
  const [source, routes] = await Promise.all([
    readFile(new URL("../features/partnerMarketplace/sellerChannelReconciliationPreview.js", import.meta.url), "utf8"),
    readFile(new URL("../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/\:connectionId\/reconciliation"/);
  assert.match(routes, /"inventory:read"/);
  assert.match(routes, /"product:read"/);
  assert.match(routes, /request\.effectiveAuthority\.locationId/);
  assert.match(source, /business: businessId, sku:/);
  assert.doesNotMatch(source, /\.bulkWrite\(|\.updateOne\(|\.save\(/);
});
