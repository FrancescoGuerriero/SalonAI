import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  proposeSellerLocationMapping, listSellerLocationMappingProposals,
} from "../features/partnerMarketplace/sellerChannelLocationMappingProposal.js";

const businessId = "507f1f77bcf86cd799439021";
const foreign = "507f1f77bcf86cd799439022";
const connectionId = "507f1f77bcf86cd799439025";
const actorId = "507f1f77bcf86cd799439024";
const productId = "507f1f77bcf86cd799439027";
const locationId = "507f1f77bcf86cd799439023";
const proposalId = "507f1f77bcf86cd799439030";
const connection = {
  _id: connectionId, business: businessId, provider: "ebay", status: "connected",
};
const staged = {
  business: businessId, connection: connectionId, provider: "ebay",
  kind: "listings", externalId: "SOURCE-SKU",
  sourceRecord: { sku: "sku-01" }, lastObservedAt: new Date("2026-11-20T12:00:00Z"),
};
const product = {
  _id: productId, business: businessId, location: locationId, sku: "SKU-01",
};
const location = { _id: locationId, business: businessId, status: "active" };

function findOneFixture(value, queries, key) {
  return {
    findOne: (query) => {
      queries[key].push(query);
      return { session: () => ({ select: () => ({ lean: async () => value }) }) };
    },
  };
}
function setup({
  source = staged, commerceProduct = product, commerceLocation = location,
  duplicate = null, createError = null, auditError = null,
} = {}) {
  const queries = { staged: [], product: [], location: [], proposal: [] };
  const created = [];
  const audited = [];
  let sessions = 0;
  let ended = 0;
  const proposalModel = {
    ...findOneFixture(duplicate, queries, "proposal"),
    create: async (docs, options) => {
      assert.ok(options.session);
      if (createError) throw createError;
      created.push(...docs);
      return [{ _id: proposalId, ...docs[0] }];
    },
  };
  const auditModel = {
    create: async (docs, options) => {
      assert.ok(options.session);
      if (auditError) throw auditError;
      audited.push(...docs);
    },
  };
  return {
    queries, created, audited,
    get sessions() { return sessions; },
    get ended() { return ended; },
    stagedModel: findOneFixture(source, queries, "staged"),
    productModel: findOneFixture(commerceProduct, queries, "product"),
    locationModel: findOneFixture(commerceLocation, queries, "location"),
    proposalModel, auditModel,
    startSession: async () => {
      sessions++;
      return {
        withTransaction: (work) => work(),
        endSession: async () => { ended++; },
      };
    },
  };
}
const params = {
  businessId, locationAccessMode: "all", actorId,
  externalListingId: "SOURCE-SKU", commerceProductId: productId,
  commerceLocationId: locationId,
};

test("seller location candidate validates ownership and audits an unapproved proposal", async () => {
  const f = setup();
  const result = await proposeSellerLocationMapping(connection, { ...params, ...f });
  assert.equal(f.sessions, 1);
  assert.equal(f.ended, 1);
  assert.deepEqual(f.queries.staged[0], {
    business: businessId, connection: connectionId, provider: "ebay",
    kind: "listings", externalId: "SOURCE-SKU",
  });
  assert.deepEqual(f.queries.location[0], {
    _id: locationId, business: businessId, status: "active",
  });
  assert.deepEqual(f.queries.product[0], {
    _id: productId, business: businessId, location: locationId,
  });
  assert.equal(f.created.length, 1);
  assert.equal(f.created[0].reviewStatus, "pending_provider_location_evidence");
  assert.equal(f.created[0].evidenceSource, "operator_candidate");
  assert.equal(f.audited.length, 1);
  assert.equal(f.audited[0].action, "seller_location_mapping_proposed");
  assert.equal(f.audited[0].resourceId, proposalId);
  assert.equal(result.sourceSku, "SKU-01");
  assert.equal(result.locationMappingVerified, false);
  assert.equal(result.quantityComparisonAccepted, false);
  assert.equal(result.stockUpdatesApplied, 0);
  assert.equal(result.providerWritesEnabled, false);
  assert.equal(result.associationApproved, false);
  assert.equal(result.canonicalRecordsWritten, 0);
});

test("invalid tenant, provider and location scope reject before database access", async () => {
  for (const [conn, fields] of [
    [connection, { businessId: foreign }],
    [connection, { locationAccessMode: "selected" }],
    [{ ...connection, provider: "stripe" }, {}],
    [{ ...connection, status: "revoked" }, {}],
    [{ ...connection, _id: "invalid" }, {}],
    [connection, { actorId: "invalid" }],
    [connection, { commerceLocationId: "invalid" }],
    [connection, { externalListingId: "\r\n=HYPERLINK(1)" }],
    [connection, { requestId: "x".repeat(121) }],
  ]) {
    const f = setup();
    await assert.rejects(
      proposeSellerLocationMapping(conn, { ...params, ...fields, ...f }),
    );
    assert.equal(f.sessions, 0);
    assert.equal(f.queries.staged.length, 0);
  }
});

test("foreign or inconsistent provider, product and location evidence cannot create a proposal", async () => {
  for (const options of [
    { source: { ...staged, business: foreign } },
    { source: { ...staged, provider: "amazon_seller_central" } },
    { source: { ...staged, sourceRecord: { sku: "" } } },
    { source: null },
    { commerceProduct: { ...product, business: foreign } },
    { commerceProduct: { ...product, sku: "WRONG" } },
    { commerceProduct: { ...product, location: foreign } },
    { commerceLocation: { ...location, business: foreign } },
    { commerceLocation: { ...location, status: "inactive" } },
    { commerceLocation: null },
    { duplicate: { _id: proposalId } },
  ]) {
    const f = setup(options);
    await assert.rejects(
      proposeSellerLocationMapping(connection, { ...params, ...f }),
    );
    assert.equal(f.created.length, 0);
    assert.equal(f.audited.length, 0);
    assert.equal(f.ended, 1);
  }
});

test("duplicate index collision and audit failures never claim a candidate was committed", async () => {
  for (const options of [
    { createError: Object.assign(new Error("duplicate"), { code: 11000 }) },
    { auditError: new Error("audit-failed") },
  ]) {
    const f = setup(options);
    await assert.rejects(proposeSellerLocationMapping(connection, { ...params, ...f }));
    assert.equal(f.ended, 1);
    if (options.createError) assert.equal(f.audited.length, 0);
  }
});

test("read-only location candidate list is tenant scoped and never reports verified stock", async () => {
  const queries = [];
  const proposalModel = {
    find: (filter) => {
      queries.push(filter);
      return {
        select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{
          business: businessId, connection: connectionId,
          provider: "ebay", externalListingId: "SOURCE-SKU",
          sourceSku: "SKU-01", commerceProduct: productId,
          commerceLocation: locationId,
          reviewStatus: "pending_provider_location_evidence",
          evidenceSource: "operator_candidate",
        }] }) }) }),
      };
    },
  };
  const report = await listSellerLocationMappingProposals(connection, {
    businessId, locationAccessMode: "all", proposalModel,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].business, businessId);
  assert.equal(queries[0].connection, connectionId);
  assert.equal(report.records[0].locationMappingVerified, false);
  assert.equal(report.records[0].quantityComparisonAccepted, false);
  assert.equal(report.stockUpdatesApplied, 0);
  assert.equal(report.canonicalRecordsWritten, 0);
  assert.equal(report.readOnly, true);
});

test("invalid proposed mapping evidence fails closed on list reads", async () => {
  for (const wrong of [
    { business: foreign },
    { connection: foreign },
    { provider: "amazon_seller_central" },
    { reviewStatus: "approved" },
    { evidenceSource: "provider_verified" },
    { commerceLocation: "invalid" },
  ]) {
    const row = {
      business: businessId, connection: connectionId, provider: "ebay",
      externalListingId: "SOURCE-SKU", sourceSku: "SKU-01",
      commerceProduct: productId, commerceLocation: locationId,
      reviewStatus: "pending_provider_location_evidence",
      evidenceSource: "operator_candidate", ...wrong,
    };
    const proposalModel = { find: () => ({
      select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [row] }) }) }),
    }) };
    await assert.rejects(
      listSellerLocationMappingProposals(connection, {
        businessId, locationAccessMode: "all", proposalModel,
      }),
      (error) => error.details?.code === "SELLER_LOCATION_PROPOSAL_EVIDENCE_INVALID",
    );
  }
});

test("seller location proposal routes enforce all permissions and forbid stock operations", async () => {
  const routes = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  const service = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelLocationMappingProposal.js", import.meta.url), "utf8");
  assert.match(routes, /router\.post\("\/:connectionId\/location-mapping-proposals"/);
  assert.match(routes, /requirePermissions\("feature-control:update"\)/);
  assert.match(routes, /requirePermissions\("inventory:read"\)/);
  assert.match(routes, /requirePermissions\("product:read"\)/);
  assert.match(routes, /requireSellerTenantWideLocation/);
  assert.match(service, /withSellerAtomicSourceCommit/);
  assert.doesNotMatch(service, /\.bulkWrite\(|\.updateOne\(|\.save\(/);
});
