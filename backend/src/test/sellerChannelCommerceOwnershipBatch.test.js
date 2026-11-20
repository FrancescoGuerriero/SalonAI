import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { inspectSellerCommerceOrderBatch } from "../features/partnerMarketplace/sellerChannelCommerceOwnershipBatch.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const connection = {
  business: businessId, _id: connectionId, provider: "ebay", status: "connected",
};
const unlinked = (id) => ({
  externalOrderId: id, linkStatus: "unlinked",
  orderOwnershipVerified: false, commerceStateCompared: false,
  proposedCommerceOrderId: null,
});
const pending = (id, commerceId = "507f1f77bcf86cd799439027") => ({
  externalOrderId: id, linkStatus: "proposal_pending_verification",
  orderOwnershipVerified: false, commerceStateCompared: false,
  proposedCommerceOrderId: commerceId,
});
const review = (records) => ({
  records, inspectedCount: records.length,
  readOnly: true, canonicalOrdersCompared: false,
  canonicalRecordsWritten: 0, linksWritten: 0,
  summary: { possiblyTruncated: false },
});
const approvedNone = (externalOrderId, proposedCommerceOrderId) => ({
  externalOrderId, proposedCommerceOrderId,
  status: "requires_operator_correspondence_review",
  commerceBusinessOwnershipConfirmed: true,
  financialEvidenceMatches: true, associationApproved: false,
  orderCorrespondenceVerified: false,
  canonicalRecordsWritten: 0, linksWritten: 0, readOnly: true,
});

test("batch distinguishes unlinked and proposed orders without approving either", async () => {
  const seen = [];
  const result = await inspectSellerCommerceOrderBatch(connection, {
    businessId, locationAccessMode: "all", limit: 5,
    inspectLinks: async (_conn, options) => {
      assert.equal(options.limit, 5);
      return review([unlinked("EB-1"), pending("EB-2")]);
    },
    inspectOwnership: async (_conn, externalOrderId, options) => {
      seen.push(externalOrderId);
      assert.equal(options.businessId, businessId);
      return approvedNone(externalOrderId, "507f1f77bcf86cd799439027");
    },
  });
  assert.deepEqual(seen, ["EB-2"]);
  assert.deepEqual(result.summary, {
    unlinked: 1, reviewedHold: 0, proposalsInspected: 1, approved: 0,
    possiblyTruncated: false,
  });
  assert.equal(result.records[0].status, "unlinked");
  assert.equal(result.records[1].status, "requires_operator_correspondence_review");
  assert.ok(result.records.every((entry) => entry.associationApproved === false));
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.ok(Object.isFrozen(result.records));
});

test("batch limits and malformed link inspections fail closed", async () => {
  let calls = 0;
  for (const limit of [0, 11, -1, "bad", 1.5]) {
    await assert.rejects(inspectSellerCommerceOrderBatch(connection, {
      businessId, locationAccessMode: "all", limit,
      inspectLinks: async () => { calls++; return review([]); },
    }), (error) => error.details?.code === "SELLER_ORDER_BATCH_LIMIT_INVALID");
  }
  assert.equal(calls, 0);
  for (const bad of [
    { ...review([]), readOnly: false },
    { ...review([]), canonicalRecordsWritten: 1 },
    { ...review([]), records: null },
    { ...review([unlinked("EB-1")]), inspectedCount: 0 },
    review([{ ...unlinked("EB-1"), orderOwnershipVerified: true }]),
  ]) {
    await assert.rejects(inspectSellerCommerceOrderBatch(connection, {
      businessId, locationAccessMode: "all",
      inspectLinks: async () => bad,
    }), (error) => error.details?.code === "SELLER_ORDER_BATCH_EVIDENCE_INVALID");
  }
});

test("batch rejects fabricated Commerce approvals and mismatched provider order identity", async () => {
  for (const invalid of [
    { ...approvedNone("OTHER", "507f1f77bcf86cd799439027") },
    { ...approvedNone("EB-1", "507f1f77bcf86cd799439028") },
    { ...approvedNone("EB-1", "507f1f77bcf86cd799439027"), associationApproved: true },
    { ...approvedNone("EB-1", "507f1f77bcf86cd799439027"), linksWritten: 1 },
  ]) {
    await assert.rejects(inspectSellerCommerceOrderBatch(connection, {
      businessId, locationAccessMode: "all",
      inspectLinks: async () => review([pending("EB-1")]),
      inspectOwnership: async () => invalid,
    }), (error) => error.details?.code === "SELLER_ORDER_BATCH_EVIDENCE_INVALID");
  }
});

test("new batch route preserves read-only business-wide order RBAC", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/order-ownership-batch",\s*requirePermissions\("order:read"\), requireSellerTenantWideLocation/);
  assert.match(routes, /inspectSellerCommerceOrderBatch\(await ownedConnection\(request\)/);
  assert.match(routes, /"private, no-store"/);
});

test("held proposals bypass ownership preflight and never obtain approval", async () => {
  let calls = 0;
  const result = await inspectSellerCommerceOrderBatch(connection, {
    businessId, locationAccessMode: "all",
    inspectLinks: async () => review([{
      ...pending("EB-HOLD"), linkStatus: "reviewed_hold",
      reviewReason: "correspondence_unproven",
    }]),
    inspectOwnership: async () => { calls++; throw new Error("must not run"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.summary.reviewedHold, 1);
  assert.equal(result.summary.proposalsInspected, 0);
  assert.equal(result.records[0].status, "reviewed_hold");
  assert.equal(result.records[0].associationApproved, false);
});
