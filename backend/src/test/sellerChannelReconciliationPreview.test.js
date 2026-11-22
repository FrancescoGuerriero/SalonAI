import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { previewSellerChannelInventory } from "../features/partnerMarketplace/sellerChannelReconciliationPreview.js";

const businessId = "507f1f77bcf86cd799439021";
const foreign = "507f1f77bcf86cd799439022";
const locationId = "507f1f77bcf86cd799439023";
const connection = {
  _id: "507f1f77bcf86cd799439025", business: businessId,
  provider: "ebay", status: "connected",
};

function fixture(staged = [], canonical = []) {
  const queries = { staged: [], products: [], productProjection: [] };
  const stagedModel = {
    find: (query) => {
      queries.staged.push(query);
      return { sort: () => ({ limit: () => ({ lean: async () => staged.map((row) =>
        row === null ? row : ({
          business: businessId, connection: connection._id,
          provider: connection.provider, kind: "listings", ...row,
        })) }) }) };
    },
  };
  const productModel = {
    find: (query) => {
      queries.products.push(query);
      return { select: (fields) => {
        queries.productProjection.push(fields);
        return { lean: async () => canonical.map((row) =>
        row === null ? row : ({ business: businessId, ...row })) }; } };
    },
  };
  return { stagedModel, productModel, queries };
}

test("seller SKU review does not claim verified location inventory or stock variance", async () => {
  const f = fixture([
    { externalId: "SKU-01", sourceRecord: { sku: "SKU-01", quantity: 6 } },
  ], [{ _id: "507f1f77bcf86cd799439027", sku: "SKU-01", location: locationId, stockQuantity: 3 }]);
  const result = await previewSellerChannelInventory(connection, {
    businessId, locationId, ...f,
  });
  assert.equal(result.records[0].state, "marketplace_location_mapping_required");
  assert.equal(result.records[0].quantityDifference, null);
  assert.equal(result.records[0].canonicalQuantity, null);
  assert.equal(result.records[0].canonicalProductId, null);
  assert.equal(result.marketplaceLocationMappingVerified, false);
  assert.equal(result.quantityComparisonAccepted, false);
  assert.equal(result.records[0].marketplaceLocationMappingVerified, false);
  assert.equal(result.records[0].quantityComparisonAccepted, false);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(result.comparisonMode, "dry_run_only");
  assert.equal(f.queries.products[0].business, businessId);
  assert.ok(f.queries.productProjection[0].split(" ").includes("business"));
  assert.deepEqual(f.queries.products[0].sku.$in, ["SKU-01"]);
  assert.equal(f.queries.staged[0].connection, connection._id);
  assert.equal(f.queries.staged[0].provider, connection.provider);
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
  await assert.rejects(previewSellerChannelInventory({ ...connection, provider: "stripe" }, { businessId, ...f }));
  await assert.rejects(previewSellerChannelInventory({ ...connection, _id: "invalid" }, { businessId, ...f }));
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

test("duplicate marketplace SKUs differing only in case never produce an actionable stock delta", async () => {
  const staged = [
    { externalId: "remote-one", sourceRecord: { sku: "same-sku", quantity: 8 } },
    { externalId: "remote-two", sourceRecord: { sku: "SAME-SKU", quantity: 9 } },
  ];
  const canonical = [
    { _id: "507f1f77bcf86cd799439027", sku: "SAME-SKU",
      location: locationId, stockQuantity: 8 },
  ];
  const f = fixture(staged, canonical);
  const report = await previewSellerChannelInventory(connection, {
    businessId, locationId, ...f,
  });
  assert.deepEqual(report.records.map((row) => row.state),
    ["ambiguous_staged_sku", "ambiguous_staged_sku"]);
  assert.ok(report.records.every((row) =>
    row.canonicalQuantity === null && row.quantityDifference === null &&
    row.canonicalProductId === null));
  assert.deepEqual(f.queries.products[0].sku.$in, ["SAME-SKU"]);
  assert.equal(report.canonicalRecordsWritten, 0);
  assert.equal(report.stockUpdatesApplied, 0);
});

test("inventory reconciliation reports candidate mappings as unresolved and never issues stock deltas", async () => {
  const f = fixture([
    { externalId: "ONE", sourceRecord: { sku: "ONE", quantity: 3 } },
    { externalId: "TWO", sourceRecord: { sku: "TWO", quantity: 8 } },
    { externalId: "UNKNOWN", sourceRecord: { sku: "UNKNOWN", quantity: 2 } },
    { externalId: "MISSING", sourceRecord: { sku: "", quantity: 0 } },
  ], [
    { _id: "507f1f77bcf86cd799439027", sku: "ONE", location: locationId, stockQuantity: 3 },
    { _id: "507f1f77bcf86cd799439028", sku: "TWO", location: locationId, stockQuantity: 6 },
  ]);
  const result = await previewSellerChannelInventory(connection, {
    businessId, locationId, limit: 10, ...f,
  });
  assert.deepEqual(result.summary, {
    matched: 0, quantityDiffers: 0, mappingRequired: 2, unresolved: 4,
    potentialStockChanges: 0, examinedRowsOnly: true, possiblyTruncated: false,
  });
  assert.equal(result.records.find((row) => row.sku === "TWO").quantityDifference, null);
  assert.equal(result.records.find((row) => row.sku === "ONE").quantityDifference, null);
  assert.ok(result.records.every((row) => row.quantityComparisonAccepted === false));
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.ok(Object.isFrozen(result.summary));
});

test("inventory reconciliation flags full preview as possibly truncated rather than fully synced", async () => {
  const f = fixture([
    { externalId: "SKU-ONLY", sourceRecord: { sku: "SKU-ONLY", quantity: null } },
  ]);
  const result = await previewSellerChannelInventory(connection, {
    businessId, locationId, limit: 1, ...f,
  });
  assert.equal(result.reviewedCount, 1);
  assert.equal(result.summary.possiblyTruncated, true);
  assert.equal(result.summary.unresolved, 1);
  assert.equal(result.summary.mappingRequired, 0);
  assert.equal(result.summary.potentialStockChanges, 0);
});

test("seller inventory fails closed on cross-tenant, cross-provider and duplicate staged evidence", async () => {
  const valid = { externalId: "SKU-01", sourceRecord: { sku: "SKU-01", quantity: 3 } };
  const scenarios = [
    [ { ...valid, business: foreign } ],
    [ { ...valid, connection: "507f1f77bcf86cd799439099" } ],
    [ { ...valid, provider: "amazon_seller_central" } ],
    [ { ...valid, kind: "orders" } ],
    [ { ...valid, externalId: "" } ],
    [ valid, { ...valid } ],
    [ null ],
    [ { ...valid, sourceRecord: null } ],
  ];
  for (const records of scenarios) {
    const f = fixture(records);
    await assert.rejects(
      previewSellerChannelInventory(connection, { businessId, locationId, ...f }),
      (error) => error.details?.code === "SELLER_INVENTORY_STAGED_EVIDENCE_INVALID",
    );
    assert.equal(f.queries.products.length, 0);
  }
});

test("seller inventory rejects canonical Commerce evidence outside the trusted tenant and SKU set", async () => {
  const staged = [{ externalId: "ONE", sourceRecord: { sku: "ONE", quantity: 5 } }];
  const cases = [
    [{ _id: "507f1f77bcf86cd799439027", business: foreign, sku: "ONE",
      location: locationId, stockQuantity: 5 }],
    [{ _id: "507f1f77bcf86cd799439027", sku: "UNREQUESTED",
      location: locationId, stockQuantity: 5 }],
    [{ _id: null, sku: "ONE", location: locationId, stockQuantity: 5 }],
  ];
  for (const products of cases) {
    const f = fixture(staged, products);
    await assert.rejects(
      previewSellerChannelInventory(connection, { businessId, locationId, ...f }),
      (error) => error.details?.code === "SELLER_INVENTORY_COMMERCE_EVIDENCE_INVALID",
    );
  }
});

test("case-normalised Commerce SKU evidence still matches and remains read-only", async () => {
  const f = fixture(
    [{ externalId: "a", sourceRecord: { sku: "sku-01", quantity: 3 } }],
    [{ _id: "507f1f77bcf86cd799439027", sku: " sku-01 ",
      location: locationId, stockQuantity: 3 }],
  );
  const report = await previewSellerChannelInventory(connection, { businessId, locationId, ...f });
  assert.equal(report.records[0].state, "marketplace_location_mapping_required");
  assert.equal(report.records[0].canonicalQuantity, null);
  assert.equal(report.records[0].quantityDifference, null);
  assert.equal(report.stockUpdatesApplied, 0);
});

test("equal and unequal marketplace quantities both require verified location mapping", async () => {
  for (const marketplaceQuantity of [3, 6]) {
    const f = fixture([
      { externalId: "SOURCE-SKU", sourceRecord: { sku: "SOURCE-SKU", quantity: marketplaceQuantity } },
    ], [{ _id: "507f1f77bcf86cd799439027", sku: "SOURCE-SKU",
      location: locationId, stockQuantity: 3 }]);
    const report = await previewSellerChannelInventory(connection, { businessId, locationId, ...f });
    assert.equal(report.records[0].state, "marketplace_location_mapping_required");
    assert.equal(report.records[0].marketplaceQuantity, marketplaceQuantity);
    assert.equal(report.records[0].canonicalQuantity, null);
    assert.equal(report.records[0].quantityDifference, null);
    assert.equal(report.summary.matched, 0);
    assert.equal(report.summary.quantityDiffers, 0);
    assert.equal(report.summary.mappingRequired, 1);
  }
});

test("no trusted Commerce location means source quantity is observation only", async () => {
  const f = fixture([{ externalId: "ONE", sourceRecord: { sku: "ONE", quantity: 3 } }],
    [{ _id: "507f1f77bcf86cd799439027", sku: "ONE",
      location: locationId, stockQuantity: 3 }]);
  const report = await previewSellerChannelInventory(connection, { businessId, ...f });
  assert.equal(report.records[0].state, "location_selection_required");
  assert.equal(report.records[0].quantityDifference, null);
  assert.equal(report.records[0].canonicalQuantity, null);
  assert.equal(report.summary.mappingRequired, 0);
  assert.equal(report.quantityComparisonAccepted, false);
});
