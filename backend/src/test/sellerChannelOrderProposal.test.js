import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { proposeSellerCommerceOrderLink } from "../features/partnerMarketplace/sellerChannelOrderProposal.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const actorId = "507f1f77bcf86cd799439024";
const commerceOrderId = "507f1f77bcf86cd799439027";
const connection = { _id: connectionId, business: businessId, provider: "ebay", status: "connected" };
const staged = { business: businessId, connection: connectionId, provider: "ebay",
  kind: "orders", externalId: "EB-100" };
function fixture({ stage = staged, ownedOrder = { _id: commerceOrderId, business: businessId },
  existing = null, auditFailure = false, duplicate = false } = {}) {
  let proposal = null;
  const audit = [], scopes = { staged: [], orders: [], links: [] };
  const chain = (value) => ({
    session: () => ({ select: () => ({ lean: async () => value }) }),
  });
  const stagedModel = { findOne: (query) => {
    scopes.staged.push(query); return chain(stage);
  } };
  const orderModel = { findOne: (query) => {
    scopes.orders.push(query); return chain(ownedOrder);
  } };
  const linkModel = {
    findOne: (query) => { scopes.links.push(query); return chain(existing); },
    create: async (docs, opts) => {
      assert.ok(opts.session);
      if (duplicate) throw Object.assign(new Error("duplicate"), { code: 11000 });
      proposal = { _id: commerceOrderId, ...docs[0] };
      return [proposal];
    },
  };
  const auditModel = { create: async (records, opts) => {
    assert.ok(opts.session);
    if (auditFailure) throw new Error("audit unavailable");
    audit.push(...records);
  } };
  const startSession = async () => ({
    withTransaction: async (fn) => {
      const before = proposal;
      try { await fn(); } catch (error) { proposal = before; throw error; }
    },
    endSession: async () => {},
  });
  return { stagedModel, orderModel, linkModel, auditModel, startSession,
    scopes, audit, get proposal() { return proposal; } };
}
const options = { businessId, locationAccessMode: "all", actorId, commerceOrderId };

test("proposal is pending and audited, never accepted or executed", async () => {
  const f = fixture();
  const result = await proposeSellerCommerceOrderLink(connection, "EB-100", { ...options, ...f });
  assert.equal(result.reviewStatus, "pending_verification");
  assert.equal(result.associationApproved, false);
  assert.equal(result.orderCorrespondenceVerified, false);
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(f.audit.length, 1);
  assert.equal(f.audit[0].action, "seller_order_link_proposed");
  assert.equal(f.proposal.verificationStatus, "pending_verification");
  assert.deepEqual(f.scopes.orders[0], { _id: commerceOrderId, business: businessId });
  assert.equal(f.scopes.links[0].business, businessId);
  assert.equal(f.scopes.links[0].$or.length, 2);
});

test("invalid authority, external references and foreign ownership fail before writing", async () => {
  const invalid = [
    [connection, "EB-100", { ...options, businessId: "507f1f77bcf86cd799439099" }],
    [connection, "EB-100", { ...options, actorId: "bad" }],
    [connection, "EB-100", { ...options, locationAccessMode: "selected" }],
    [connection, "../EB-100", options],
    [connection, "EB-100", { ...options, commerceOrderId: "invalid" }],
    [{ ...connection, status: "revoked" }, "EB-100", options],
  ];
  for (const [conn, externalId, input] of invalid) {
    const f = fixture();
    await assert.rejects(proposeSellerCommerceOrderLink(conn, externalId, { ...input, ...f }));
    assert.equal(f.scopes.staged.length, 0);
    assert.equal(f.audit.length, 0);
    assert.equal(f.proposal, null);
  }
  for (const changed of [
    { stage: null },
    { stage: { ...staged, business: "507f1f77bcf86cd799439099" } },
    { ownedOrder: null },
    { ownedOrder: { _id: commerceOrderId } },
    { ownedOrder: { _id: commerceOrderId, business: "507f1f77bcf86cd799439099" } },
  ]) {
    const f = fixture(changed);
    await assert.rejects(proposeSellerCommerceOrderLink(connection, "EB-100", { ...options, ...f }));
    assert.equal(f.proposal, null);
    assert.equal(f.audit.length, 0);
  }
});

test("duplicate external or Commerce order proposals fail without an audit event", async () => {
  for (const settings of [
    { existing: { _id: commerceOrderId } },
    { duplicate: true },
  ]) {
    const f = fixture(settings);
    await assert.rejects(proposeSellerCommerceOrderLink(connection, "EB-100", {
      ...options, ...f,
    }), (error) => error.details?.code === "SELLER_PROPOSAL_CONFLICT");
    assert.equal(f.audit.length, 0);
  }
});

test("failed proposal audit aborts the proposed association", async () => {
  const f = fixture({ auditFailure: true });
  await assert.rejects(proposeSellerCommerceOrderLink(connection, "EB-100", {
    ...options, ...f,
  }), /audit unavailable/);
  assert.equal(f.proposal, null);
});

test("route accepts only authorised business-wide order editors", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /router\.post\("\/:connectionId\/order-links\/:externalOrderId\/propose",\s*requirePermissions\("order:update"\), requireSellerTenantWideLocation/);
  assert.match(routes, /proposeSellerCommerceOrderLink\(/);
});
