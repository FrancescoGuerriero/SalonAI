import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import SellerChannelOrderLink from "../models/SellerChannelOrderLink.js";
import { inspectSellerChannelOrderLinks } from "../features/partnerMarketplace/sellerChannelOrderLinkInspection.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const orderId = "507f1f77bcf86cd799439027";
const foreignBusiness = "507f1f77bcf86cd799439099";
const connection = { _id: connectionId, business: businessId, provider: "ebay", status: "connected" };
const row = (externalId, extra = {}) => ({
  business: businessId, connection: connectionId, provider: "ebay", kind: "orders",
  externalId, ...extra,
});
const proposal = (externalOrderId, extra = {}) => ({
  business: businessId, connection: connectionId, provider: "ebay",
  externalOrderId, commerceOrder: orderId,
  evidenceSource: "operator_proposal", verificationStatus: "pending_verification",
  ...extra,
});
function fixture(rows = [], links = []) {
  const stagedQueries = [], linkQueries = [];
  return {
    stagedQueries, linkQueries,
    stagedModel: { find(query) {
      stagedQueries.push(query);
      return { sort: () => ({ limit: () => ({ lean: async () => rows }) }) };
    } },
    linkModel: { find(query) {
      linkQueries.push(query);
      return { select: () => ({ lean: async () => links }) };
    } },
  };
}
const options = { businessId, locationAccessMode: "all", limit: 10 };

test("unlinked marketplace orders stay explicit and never match Commerce by inference", async () => {
  const f = fixture([row("EB-1"), row("EB-2")]);
  const result = await inspectSellerChannelOrderLinks(connection, { ...options, ...f });
  assert.deepEqual(result.records.map((r) => r.linkStatus), ["unlinked", "unlinked"]);
  assert.deepEqual(result.summary, {
    unlinked: 2, pendingVerification: 0, verified: 0, possiblyTruncated: false,
  });
  assert.equal(result.canonicalOrdersCompared, false);
  assert.equal(result.linksWritten, 0);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.deepEqual(f.stagedQueries[0], {
    business: businessId, connection: connectionId, provider: "ebay", kind: "orders",
  });
  assert.deepEqual(f.linkQueries[0], {
    business: businessId, connection: connectionId, provider: "ebay",
    externalOrderId: { $in: ["EB-1", "EB-2"] },
  });
  assert.ok(Object.isFrozen(result.records));
  assert.ok(Object.isFrozen(result.summary));
});

test("explicit association proposals remain unverified and never claim Commerce ownership", async () => {
  const f = fixture([row("EB-1"), row("EB-2")], [proposal("EB-1")]);
  const result = await inspectSellerChannelOrderLinks(connection, { ...options, ...f });
  assert.equal(result.records[0].linkStatus, "proposal_pending_verification");
  assert.equal(result.records[0].proposedCommerceOrderId, orderId);
  assert.equal(result.records[0].orderOwnershipVerified, false);
  assert.equal(result.records[0].commerceStateCompared, false);
  assert.equal(result.records[1].proposedCommerceOrderId, null);
  assert.deepEqual(result.summary, {
    unlinked: 1, pendingVerification: 1, verified: 0, possiblyTruncated: false,
  });
  assert.equal(result.productionAccepted, false);
  assert.equal(result.readOnly, true);
});

test("bad business, location, connection or limits are denied before queries", async () => {
  for (const over of [
    { businessId: foreignBusiness }, { businessId: "wrong" },
    { locationAccessMode: "selected" }, { locationAccessMode: undefined },
    { limit: 0 }, { limit: 51 }, { limit: "bad" },
  ]) {
    const f = fixture();
    await assert.rejects(inspectSellerChannelOrderLinks(connection, {
      ...options, ...over, ...f,
    }));
    assert.equal(f.stagedQueries.length, 0);
    assert.equal(f.linkQueries.length, 0);
  }
  for (const badConnection of [
    { ...connection, provider: "other" }, { ...connection, status: "revoked" },
    { ...connection, business: foreignBusiness },
  ]) {
    const f = fixture();
    await assert.rejects(inspectSellerChannelOrderLinks(badConnection, { ...options, ...f }));
    assert.equal(f.stagedQueries.length, 0);
  }
});

test("duplicate, foreign and unverified source evidence fails closed", async () => {
  const failures = [
    fixture([row("EB-1"), row("EB-1")]),
    fixture([row("EB-1", { business: foreignBusiness })]),
    fixture([row("EB-1", { kind: "listings" })]),
    fixture([row("")]),
    fixture([row("EB-1")], [proposal("EB-1"), proposal("EB-1")]),
    fixture([row("EB-1")], [proposal("OTHER")]),
    fixture([row("EB-1")], [proposal("EB-1", { business: foreignBusiness })]),
    fixture([row("EB-1")], [proposal("EB-1", { provider: "amazon_seller_central" })]),
    fixture([row("EB-1")], [proposal("EB-1", { verificationStatus: "verified" })]),
    fixture([row("EB-1")], [proposal("EB-1", { commerceOrder: "bad" })]),
    fixture([row("EB-1"), row("EB-2")], [proposal("EB-1"), proposal("EB-2")]),
  ];
  for (const f of failures) {
    await assert.rejects(inspectSellerChannelOrderLinks(connection, { ...options, ...f }),
      (error) => error.details?.code === "SELLER_ORDER_LINK_EVIDENCE_INVALID");
  }
});

test("link proposal schema enforces uniqueness without changing Commerce Order", async () => {
  const indexes = SellerChannelOrderLink.schema.indexes();
  assert.ok(indexes.some(([fields, options]) =>
    fields.business === 1 && fields.connection === 1 &&
    fields.externalOrderId === 1 && options.unique === true));
  assert.ok(indexes.some(([fields, options]) =>
    fields.business === 1 && fields.commerceOrder === 1 && options.unique === true));
  const draft = new SellerChannelOrderLink({
    business: businessId, connection: connectionId, provider: "ebay",
    externalOrderId: "EB-1", commerceOrder: orderId,
  });
  assert.equal(draft.validateSync(), undefined);
  assert.equal(draft.verificationStatus, "pending_verification");
  assert.equal(draft.evidenceSource, "operator_proposal");
  draft.verificationStatus = "verified";
  assert.ok(draft.validateSync());
});

test("order link review route is read-only and gated by existing order permission", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  const service = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelOrderLinkInspection.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/order-links", requirePermissions\("order:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /inspectSellerChannelOrderLinks\(await ownedConnection\(request\)/);
  assert.doesNotMatch(service, /\.create\(|\.save\(|\.updateOne\(|\.bulkWrite\(/);
});
