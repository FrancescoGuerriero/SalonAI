import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { withSellerImportLease } from "../features/partnerMarketplace/sellerChannelImportLeaseService.js";

const businessId = "507f1f77bcf86cd799439021";
const connectionId = "507f1f77bcf86cd799439025";
const kind = "listings";

function sharedLeaseModel() {
  const active = new Map();
  const created = [];
  const released = [];
  function key(record) {
    return [record.business, record.connection, record.kind].join(":");
  }
  return {
    active, created, released,
    async create(record) {
      if (active.has(key(record))) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      created.push(record);
      active.set(key(record), record);
      return record;
    },
    async findOneAndUpdate(filter, update) {
      const existing = active.get(key(filter));
      if (!existing || existing.owner !== filter.owner ||
          new Date(existing.expiresAt).getTime() <= new Date(filter.expiresAt.$gt).getTime()) return null;
      const refreshed = { ...existing, expiresAt: update.$set.expiresAt };
      active.set(key(filter), refreshed);
      return refreshed;
    },
    async deleteOne(filter) {
      released.push(filter);
      const previous = active.get(key(filter));
      if (previous?.owner === filter.owner) active.delete(key(filter));
    },
  };
}
test("two overlapping seller imports cannot enter the same tenant/connection/kind", async () => {
  const model = sharedLeaseModel();
  let unblock;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  const held = new Promise((resolve) => { unblock = resolve; });
  const scope = { businessId, connectionId, kind, leaseModel: model };
  const first = withSellerImportLease(scope, async () => {
    started();
    await held;
    return "first finished";
  });
  await entered;
  let secondEntered = false;
  await assert.rejects(withSellerImportLease(scope, async () => {
    secondEntered = true;
  }), /already running/);
  assert.equal(secondEntered, false);
  unblock();
  assert.equal(await first, "first finished");
  assert.equal(model.active.size, 0);
  assert.equal(model.released[0].owner, model.created[0].owner);
  assert.equal(await withSellerImportLease(scope, async () => "next allowed"), "next allowed");
});

test("seller lock is scoped to each tenant, connection and kind independently", async () => {
  const model = sharedLeaseModel();
  const base = { businessId, connectionId, kind, leaseModel: model };
  let finish;
  const held = new Promise((resolve) => { finish = resolve; });
  let ready;
  const entered = new Promise((resolve) => { ready = resolve; });
  const busy = withSellerImportLease(base, async () => { ready(); await held; });
  await entered;
  assert.equal(await withSellerImportLease({ ...base, kind: "orders" },
    async () => "orders allowed"), "orders allowed");
  assert.equal(await withSellerImportLease({
    ...base, businessId: "507f1f77bcf86cd799439022",
  }, async () => "other business allowed"), "other business allowed");
  finish();
  await busy;
  assert.equal(model.active.size, 0);
});

test("seller lease model defines unique ownership scope and a ten minute TTL", async () => {
  const [model, service] = await Promise.all([
    readFile(new URL("../models/SellerChannelImportLease.js", import.meta.url), "utf8"),
    readFile(new URL("../features/partnerMarketplace/sellerChannelImportLeaseService.js", import.meta.url), "utf8"),
  ]);
  assert.match(model, /business: 1, connection: 1, kind: 1.*unique: true/);
  assert.match(model, /expiresAt: 1.*expireAfterSeconds: 0/);
  assert.match(service, /TEN_MINUTES = 10 \* 60 \* 1000/);
  assert.match(service, /deleteOne\(\{ \.\.\.filter, owner \}\)/);
});

test("lease fencing refuses staging after ownership expires, without releasing another owner's lock", async () => {
  const model = sharedLeaseModel();
  const scope = { businessId, connectionId, kind, leaseModel: model };
  await assert.rejects(withSellerImportLease(scope, async (assertLeaseOwned) => {
    const key = [businessId, connectionId, kind].join(":");
    const original = model.active.get(key);
    model.active.set(key, {
      ...original, expiresAt: new Date(Date.now() - 1000),
    });
    await assertLeaseOwned();
  }), /ownership expired/);
  assert.equal(model.active.size, 0);
  assert.equal(model.released.length, 1);
});
test("expired import owner cannot delete a replacement worker's lease", async () => {
  const model = sharedLeaseModel();
  const scope = { businessId, connectionId, kind, leaseModel: model };
  const key = [businessId, connectionId, kind].join(":");
  await assert.rejects(withSellerImportLease(scope, async (assertLeaseOwned) => {
    const previous = model.active.get(key);
    model.active.set(key, {
      ...previous, owner: "replacement-import-owner",
      expiresAt: new Date(Date.now() + 600000),
    });
    await assertLeaseOwned();
  }), /ownership expired/);
  assert.equal(model.active.size, 1);
  assert.equal(model.active.get(key).owner, "replacement-import-owner");
  assert.equal(model.released.length, 1);
});
test("lease fencing renews a valid owner before a protected write", async () => {
  const model = sharedLeaseModel();
  const result = await withSellerImportLease({
    businessId, connectionId, kind, leaseModel: model,
  }, async (assertLeaseOwned) => {
    await assertLeaseOwned();
    await assertLeaseOwned();
    return "still owned";
  });
  assert.equal(result, "still owned");
  assert.equal(model.active.size, 0);
});
