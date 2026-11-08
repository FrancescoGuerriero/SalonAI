import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import AiToolMonthlyUsage from "../features/aiPlatform/AiToolMonthlyUsage.js";
import {
  aiQuotaMonthStart,
  resolveAiMetricsMonthlyLimit,
  reserveAiMetricsMonthlyAdmission,
} from "../features/aiPlatform/aiWorkforceMonthlyQuotaService.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439099";
const DATE = new Date("2026-11-08T20:00:00.000Z");

function usageFixture(initial = 0) {
  const records = new Map();
  const filters = [];
  records.set(BUSINESS, initial);
  return {
    records, filters,
    usage: {
      updateOne: async (filter, update, options) => {
        filters.push({ kind: "init", filter, update, options });
        if (!records.has(filter.business)) records.set(filter.business, 0);
        return { acknowledged: true };
      },
      findOneAndUpdate: (filter, update, options) => {
        filters.push({ kind: "reserve", filter, update, options });
        const current = records.get(filter.business) ?? 0;
        if (current >= filter.admittedCount.$lt || current < 0) {
          return { lean: async () => null };
        }
        records.set(filter.business, current + 1);
        return { lean: async () => ({ admittedCount: current + 1 }) };
      },
    },
  };
}

test("monthly quota model has unique tenant/tool/month index", () => {
  const entry = AiToolMonthlyUsage.schema.indexes().find(
    ([fields]) => fields.business === 1 && fields.toolKey === 1 && fields.periodStart === 1,
  );
  assert.equal(entry?.[1].unique, true);
});

test("quota period is UTC calendar month, independent of local timezone", () => {
  assert.equal(aiQuotaMonthStart(new Date("2026-11-30T23:59:59Z")).toISOString(),
    "2026-11-01T00:00:00.000Z");
  assert.equal(aiQuotaMonthStart(new Date("2026-12-01T00:00:00Z")).toISOString(),
    "2026-12-01T00:00:00.000Z");
});

test("subscription must explicitly grant a positive bounded integer quota", () => {
  const allowed = { entitlementGrants: [
    { key: "ai-a0-metrics-monthly", source: "plan", limit: 2 },
  ] };
  assert.equal(resolveAiMetricsMonthlyLimit(allowed), 2);
  for (const limit of [null, 0, -1, 0.5, 1000001, "2", NaN]) {
    assert.throws(() => resolveAiMetricsMonthlyLimit({
      entitlementGrants: [{ key: "ai-a0-metrics-monthly", limit }],
    }));
  }
  assert.throws(() => resolveAiMetricsMonthlyLimit({ entitlementGrants: [] }));
  assert.throws(() => resolveAiMetricsMonthlyLimit({
    entitlementGrants: [allowed.entitlementGrants[0], allowed.entitlementGrants[0]],
  }));
});

test("quota reserve is an atomic conditional admission and fails closed after exhaustion", async () => {
  const fixture = usageFixture();
  const first = await reserveAiMetricsMonthlyAdmission({
    businessId: BUSINESS, monthlyLimit: 2, now: DATE,
  }, fixture);
  const second = await reserveAiMetricsMonthlyAdmission({
    businessId: BUSINESS, monthlyLimit: 2, now: DATE,
  }, fixture);
  assert.equal(first.admittedCount, 1);
  assert.equal(second.remaining, 0);
  await assert.rejects(reserveAiMetricsMonthlyAdmission({
    businessId: BUSINESS, monthlyLimit: 2, now: DATE,
  }, fixture), (error) => error.code === "AI_MONTHLY_QUOTA_EXHAUSTED");
  assert.equal(fixture.records.get(BUSINESS), 2);
  for (const { filter, options } of fixture.filters.filter((e) => e.kind === "reserve")) {
    assert.equal(filter.business, BUSINESS);
    assert.equal(filter.toolKey, "business.metrics.read");
    assert.equal(filter.admittedCount.$lt, 2);
    assert.equal(filter.periodStart.toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(options.upsert, false);
  }
});

test("per-tenant quota identity is isolated and does not overcount a foreign business", async () => {
  const fixture = usageFixture(1);
  const accepted = await reserveAiMetricsMonthlyAdmission({
    businessId: FOREIGN, monthlyLimit: 1, now: DATE,
  }, fixture);
  assert.equal(accepted.businessId, FOREIGN);
  assert.equal(fixture.records.get(FOREIGN), 1);
  assert.equal(fixture.records.get(BUSINESS), 1);
});

test("bad quotas and unavailable persistence never admit a call", async () => {
  for (const amount of [0, 1.3, 1000001, "5"]) {
    await assert.rejects(reserveAiMetricsMonthlyAdmission({
      businessId: BUSINESS, monthlyLimit: amount,
    }));
  }
  await assert.rejects(reserveAiMetricsMonthlyAdmission({
    businessId: "invalid", monthlyLimit: 1,
  }));
  await assert.rejects(reserveAiMetricsMonthlyAdmission({
    businessId: BUSINESS, monthlyLimit: 1,
  }, {
    usage: { updateOne: async () => { throw new Error("Mongo unavailable"); } },
  }), /Mongo unavailable/);
});

test("duplicate-key contention during initialization retries through conditional update only", async () => {
  const fixture = usageFixture();
  fixture.usage.updateOne = async () => {
    const err = new Error("duplicate key");
    err.code = 11000;
    throw err;
  };
  const result = await reserveAiMetricsMonthlyAdmission({
    businessId: BUSINESS, monthlyLimit: 1, now: DATE,
  }, fixture);
  assert.equal(result.admittedCount, 1);
  assert.equal(mongoose.isValidObjectId(result.businessId), true);
});
