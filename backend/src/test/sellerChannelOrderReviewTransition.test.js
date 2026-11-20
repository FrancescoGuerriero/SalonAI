import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { transitionSellerOrderReview } from "../features/partnerMarketplace/sellerChannelOrderReviewTransition.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const actorId = "507f1f77bcf86cd799439024";
const connection = { _id: connectionId, business: businessId,
  provider: "ebay", status: "connected" };
const staged = { business: businessId, connection: connectionId,
  provider: "ebay", kind: "orders", externalId: "EB-100" };

function fixture({ failAudit = false, missingStage = false, conflict = false } = {}) {
  let record = { _id: "507f1f77bcf86cd799439027", business: businessId,
    connection: connectionId, provider: "ebay", externalOrderId: "EB-100",
    verificationStatus: "pending_verification" };
  const audit = [];
  const calls = { updates: 0, audit, filters: [] };
  const stagedModel = { findOne: (filter) => {
    calls.filters.push(filter);
    return { session: () => ({ select: () => ({
      lean: async () => missingStage ? null : staged,
    }) }) };
  } };
  const linkModel = { findOneAndUpdate: (filter, update, opts) => {
    calls.updates++;
    calls.filters.push(filter);
    assert.equal(opts.runValidators, true);
    const next = conflict || record.verificationStatus !== filter.verificationStatus ?
      null : { ...record, ...update.$set };
    if (next) record = next;
    return { lean: async () => next };
  } };
  const auditModel = { create: async (entries, opts) => {
    assert.ok(opts.session);
    if (failAudit) throw new Error("injected-audit-failure");
    audit.push(...entries);
  } };
  const startSession = async () => ({
    withTransaction: async (fn) => {
      const before = { ...record };
      try { await fn(); } catch (error) {
        record = before;
        throw error;
      }
    },
    endSession: async () => {},
  });
  return { calls, stagedModel, linkModel, auditModel, startSession,
    state: () => record.verificationStatus };
}
const options = { businessId, locationAccessMode: "all", actorId,
  action: "hold", reason: "correspondence_unproven" };

test("operator hold writes only review state and audit with the same transaction", async () => {
  const f = fixture();
  const result = await transitionSellerOrderReview(connection, "EB-100", {
    ...options, ...f,
  });
  assert.equal(result.reviewStatus, "reviewed_hold");
  assert.equal(result.associationApproved, false);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.refundsIssued, 0);
  assert.equal(result.fulfillmentWrites, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(f.calls.audit.length, 1);
  assert.equal(f.calls.audit[0].actor, actorId);
  assert.equal(f.calls.audit[0].metadata.reason, "correspondence_unproven");
  assert.equal(f.calls.filters[1].verificationStatus, "pending_verification");
  assert.equal(f.state(), "reviewed_hold");
});

test("operator reopening a held proposal clears the hold without approval", async () => {
  const f = fixture();
  await transitionSellerOrderReview(connection, "EB-100", { ...options, ...f });
  const result = await transitionSellerOrderReview(connection, "EB-100", {
    ...options, action: "reopen", reason: "", ...f,
  });
  assert.equal(result.reviewStatus, "pending_verification");
  assert.equal(result.associationApproved, false);
  assert.equal(f.calls.audit.length, 2);
  assert.equal(f.calls.audit[1].action, "seller_order_link_reopen");
});

test("failed audit aborts the transition instead of leaving a held proposal", async () => {
  const f = fixture({ failAudit: true });
  await assert.rejects(transitionSellerOrderReview(connection, "EB-100", {
    ...options, ...f,
  }), /injected-audit-failure/);
  assert.equal(f.state(), "pending_verification");
  assert.equal(f.calls.audit.length, 0);
});

test("conflicts, missing source evidence and invalid authority fail closed", async () => {
  for (const opts of [
    { ...options, businessId: "507f1f77bcf86cd799439099" },
    { ...options, locationAccessMode: "selected" },
    { ...options, actorId: "invalid" },
    { ...options, action: "approve" },
    { ...options, reason: "=FORMULA" },
    { ...options, action: "reopen" },
  ]) {
    const f = fixture();
    await assert.rejects(transitionSellerOrderReview(connection, "EB-100", {
      ...opts, ...f,
    }));
    assert.equal(f.calls.updates, 0);
  }
  for (const variant of [{ conflict: true }, { missingStage: true }]) {
    const f = fixture(variant);
    await assert.rejects(transitionSellerOrderReview(connection, "EB-100", {
      ...options, ...f,
    }));
    assert.equal(f.calls.audit.length, 0);
  }
});

test("review route uses order update permission and tenant-wide authority", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.post\("\/:connectionId\/order-links\/:externalOrderId\/review",\s*requirePermissions\("order:update"\), requireSellerTenantWideLocation/);
  assert.match(routes, /transitionSellerOrderReview\(/);
});
