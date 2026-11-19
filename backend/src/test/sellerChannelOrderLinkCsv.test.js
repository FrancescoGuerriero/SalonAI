import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildSellerOrderLinkReviewCsv } from "../features/partnerMarketplace/sellerChannelOrderLinkCsv.js";

function review(records) {
  return {
    source: "staged_orders_and_explicit_link_proposals",
    records, inspectedCount: records.length,
    summary: { unlinked: records.length, pendingVerification: 0, verified: 0 },
    canonicalOrdersCompared: false, canonicalRecordsWritten: 0,
    linksWritten: 0, stockUpdatesApplied: 0,
    productionAccepted: false, readOnly: true,
  };
}

test("marketplace order linkage export only exposes explicitly unverified references", () => {
  const csv = buildSellerOrderLinkReviewCsv(review([
    { externalOrderId: "EB-100", linkStatus: "unlinked",
      proposedCommerceOrderId: null, orderOwnershipVerified: false,
      commerceStateCompared: false, privateBuyerEmail: "secret@example.test" },
    { externalOrderId: "AM-200", linkStatus: "proposal_pending_verification",
      proposedCommerceOrderId: "507f1f77bcf86cd799439027", orderOwnershipVerified: false,
      commerceStateCompared: false },
  ]));
  assert.match(csv, /"EB-100","unlinked","","false","false"/);
  assert.match(csv, /"AM-200","proposal_pending_verification","507f1f77bcf86cd799439027","false","false"/);
  assert.ok(!csv.includes("secret@example.test"));
  assert.equal(csv.trim().split("\r\n").length, 3);
});

test("seller CSV export cannot execute formulas or inject rows via source IDs", () => {
  const csv = buildSellerOrderLinkReviewCsv(review([
    { externalOrderId: '=HYPERLINK("http://attacker.invalid")',
      linkStatus: "unlinked", proposedCommerceOrderId: null,
      orderOwnershipVerified: false, commerceStateCompared: false },
    { externalOrderId: "A\r\n=IMPORTXML(\"bad\")",
      linkStatus: "unlinked", proposedCommerceOrderId: null,
      orderOwnershipVerified: false, commerceStateCompared: false },
    { externalOrderId: " \t+SUM(1,2)",
      linkStatus: "unlinked", proposedCommerceOrderId: null,
      orderOwnershipVerified: false, commerceStateCompared: false },
  ]));
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/attacker\.invalid""\)"/);
  assert.ok(csv.includes("A  =IMPORTXML"));
  assert.ok(csv.includes("'  +SUM"));
  assert.equal(csv.trim().split("\r\n").length, 4);
});

test("seller linkage CSV refuses fabricated verified or writable evidence", () => {
  const unlinked = { externalOrderId: "EB-1", linkStatus: "unlinked",
    proposedCommerceOrderId: null, orderOwnershipVerified: false,
    commerceStateCompared: false };
  const badReports = [
    { ...review([unlinked]), canonicalOrdersCompared: true },
    { ...review([unlinked]), canonicalRecordsWritten: 1 },
    { ...review([unlinked]), linksWritten: 1 },
    { ...review([unlinked]), stockUpdatesApplied: 1 },
    { ...review([unlinked]), readOnly: false },
    { ...review([unlinked]), productionAccepted: true },
    { ...review([unlinked]), summary: { verified: 1 } },
    { ...review([unlinked]), inspectedCount: 20 },
    review([{ ...unlinked, linkStatus: "verified" }]),
    review([{ ...unlinked, orderOwnershipVerified: true }]),
    review([{ ...unlinked, proposedCommerceOrderId: "507f1f77bcf86cd799439027" }]),
    review([{ ...unlinked, linkStatus: "proposal_pending_verification" }]),
    review(Array.from({ length: 51 }, (_, i) =>
      ({ ...unlinked, externalOrderId: "EB-" + i }))),
  ];
  for (const bad of badReports) {
    assert.throws(() => buildSellerOrderLinkReviewCsv(bad),
      (error) => error.details?.code === "SELLER_ORDER_LINK_EXPORT_INVALID");
  }
});

test("seller order-link CSV route reuses trusted order scope and no-cache headers", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/:connectionId\/order-links-export", requirePermissions\("order:read"\),\s*requireSellerTenantWideLocation/);
  assert.match(routes, /buildSellerOrderLinkReviewCsv\(result\)/);
  assert.match(routes, /"private, no-store"/);
});
