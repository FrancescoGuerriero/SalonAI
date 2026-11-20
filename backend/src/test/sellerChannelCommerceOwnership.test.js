import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import Order from "../features/commerce/Order.js";
import { inspectSellerCommerceOrderOwnership } from "../features/partnerMarketplace/sellerChannelCommerceOwnership.js";

const businessId = "507f1f77bcf86cd799439021";
const otherBusiness = "507f1f77bcf86cd799439022";
const connectionId = "507f1f77bcf86cd799439025";
const orderId = "507f1f77bcf86cd799439027";
const connection = { _id: connectionId, business: businessId, provider: "ebay", status: "connected" };
const source = { business: businessId, connection: connectionId, provider: "ebay",
  externalId: "EB-100", kind: "orders", sourceRecord: {
    amount: "125.40", currency: "GBP", placedAt: new Date("2026-10-01T12:00:00Z"),
  } };
const link = { business: businessId, connection: connectionId, provider: "ebay",
  externalOrderId: "EB-100", commerceOrder: orderId,
  evidenceSource: "operator_proposal", verificationStatus: "pending_verification" };
const commerce = { _id: orderId, business: businessId, total: 125.4, currency: "GBP", status: "paid" };
function fixture(staged = source, proposal = link, order = commerce) {
  const queries = { staged: [], links: [], orders: [] };
  const model = (key, value) => ({ findOne(query) {
    queries[key].push(query);
    return { select: () => ({ lean: async () => value }) };
  } });
  return { queries, stagedModel: model("staged", staged),
    linkModel: model("links", proposal), orderModel: model("orders", order) };
}
const options = { businessId, locationAccessMode: "all" };

test("only trusted business-owned Commerce order can pass financial preflight", async () => {
  const f = fixture();
  const result = await inspectSellerCommerceOrderOwnership(connection, "EB-100", { ...options, ...f });
  assert.equal(result.status, "requires_operator_correspondence_review");
  assert.equal(result.commerceBusinessOwnershipConfirmed, true);
  assert.equal(result.financialEvidenceMatches, true);
  assert.equal(result.orderCorrespondenceVerified, false);
  assert.equal(result.associationApproved, false);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.linksWritten, 0);
  assert.deepEqual(f.queries.orders[0], { _id: orderId, business: businessId });
  assert.equal(Object.isFrozen(result), true);
});

test("legacy and foreign-business orders cannot pass ownership check", async () => {
  const notFound = fixture(source, link, null);
  const missing = await inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...notFound,
  });
  assert.equal(missing.status, "commerce_ownership_unverified");
  assert.equal(missing.commerceBusinessOwnershipConfirmed, false);
  assert.equal(missing.associationApproved, false);
  // The real scoped MongoDB query will not return unowned records. A mocked
  // database returning such a record is inconsistent and must be rejected.
  const legacy = fixture(source, link, { ...commerce, business: undefined });
  await assert.rejects(inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...legacy,
  }), (error) => error.details?.code === "SELLER_ORDER_OWNERSHIP_INVALID_EVIDENCE");
  const foreign = fixture(source, link, { ...commerce, business: otherBusiness });
  await assert.rejects(inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...foreign,
  }), (error) => error.details?.code === "SELLER_ORDER_OWNERSHIP_INVALID_EVIDENCE");
});

test("amount mismatch, currency mismatch and incomplete source evidence cannot be approved", async () => {
  const mismatch = await inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...fixture(source, link, { ...commerce, total: 100 }),
  });
  assert.equal(mismatch.status, "financial_evidence_disagrees");
  assert.equal(mismatch.financialEvidenceMatches, false);
  const wrongCurrency = await inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...fixture(source, link, { ...commerce, currency: "EUR" }),
  });
  assert.equal(wrongCurrency.status, "financial_evidence_incomplete");
  assert.equal(wrongCurrency.financialEvidenceComparable, false);
  const missing = await inspectSellerCommerceOrderOwnership(connection, "EB-100", {
    ...options, ...fixture({ ...source, sourceRecord: {} }),
  });
  assert.equal(missing.status, "financial_evidence_incomplete");
  assert.equal(missing.associationApproved, false);
});

test("staged reference, provider and permission checks fail before Commerce lookup", async () => {
  for (const [candidate, id, opts] of [
    [connection, "../unsafe", options],
    [connection, "EB-100", { ...options, locationAccessMode: "selected" }],
    [connection, "EB-100", { ...options, businessId: otherBusiness }],
    [{ ...connection, status: "revoked" }, "EB-100", options],
  ]) {
    const f = fixture();
    await assert.rejects(inspectSellerCommerceOrderOwnership(candidate, id, { ...opts, ...f }));
    assert.equal(f.queries.orders.length, 0);
  }
  for (const bad of [null, { ...source, business: otherBusiness },
    { ...source, kind: "listings" }]) {
    const f = fixture(bad);
    await assert.rejects(inspectSellerCommerceOrderOwnership(connection, "EB-100", {
      ...options, ...f,
    }));
    assert.equal(f.queries.links.length, 0);
    assert.equal(f.queries.orders.length, 0);
  }
  for (const badLink of [null, { ...link, commerceOrder: "wrong" },
    { ...link, verificationStatus: "approved" }]) {
    const f = fixture(source, badLink);
    await assert.rejects(inspectSellerCommerceOrderOwnership(connection, "EB-100", {
      ...options, ...f,
    }));
    assert.equal(f.queries.orders.length, 0);
  }
});

test("Commerce Order supports optional ownership without inventing legacy ownership", () => {
  assert.ok(Order.schema.path("business"));
  const draft = new Order({ orderNumber: "SA-TEST" });
  assert.equal(draft.business, undefined);
  const owned = new Order({ business: businessId, orderNumber: "SA-TEST2" });
  assert.equal(String(owned.business), businessId);
});

test("ownership preflight route is read-only and restricted to business-wide order readers", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  const service = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelCommerceOwnership.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/order-links\/:externalOrderId\/ownership-review",\s*requirePermissions\("order:read"\), requireSellerTenantWideLocation/);
  assert.match(routes, /inspectSellerCommerceOrderOwnership\(/);
  assert.doesNotMatch(service, /\.save\(|\.updateOne\(|\.create\(|\.bulkWrite\(/);
});
