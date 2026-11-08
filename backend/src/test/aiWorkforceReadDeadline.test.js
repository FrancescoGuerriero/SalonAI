import assert from "node:assert/strict";
import test from "node:test";
import { withBoundedAiRead } from "../features/aiPlatform/aiWorkforceReadDeadline.js";
import { invokeGovernedBusinessMetrics } from "../features/aiPlatform/aiWorkforceReadOnlyMetricsInvocation.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const LOCATION = "507f1f77bcf86cd799439022";
const USER = "507f1f77bcf86cd799439024";
const authority = {
  businessId: BUSINESS,
  locationId: LOCATION,
  locationAccessMode: "selected",
  allowedLocationIds: [LOCATION],
  permissions: ["ai:use", "appointment:read"],
};
const composition = {
  manifest: { businessId: BUSINESS, status: "active" },
  vertical: { id: "salon" },
  enabledCapabilityPackKeys: ["ai", "appointments"],
};

test("bounded reads return normal results without waiting for the deadline", async () => {
  const result = await withBoundedAiRead(async ({ timeoutMs, signal }) => {
    assert.equal(timeoutMs, 500);
    assert.equal(signal.aborted, false);
    return 17;
  }, { timeoutMs: 500 });
  assert.equal(result, 17);
});

test("timeout aborts a non-cooperative read and returns a classified error", async () => {
  let observedSignal;
  await assert.rejects(withBoundedAiRead(
    ({ signal }) => { observedSignal = signal; return new Promise(() => {}); },
    { timeoutMs: 500 },
  ), (error) => error.code === "AI_READ_TIMEOUT");
  assert.equal(observedSignal.aborted, true);
});

test("caller cancellation aborts the read and is never classified as a success", async () => {
  const controller = new AbortController();
  let readSignal;
  const pending = withBoundedAiRead(
    ({ signal }) => { readSignal = signal; return new Promise(() => {}); },
    { timeoutMs: 1000, signal: controller.signal },
  );
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, (error) => error.code === "AI_READ_CANCELLED");
  assert.equal(readSignal.aborted, true);
  await assert.rejects(withBoundedAiRead(() => 1, { signal: controller.signal }),
    (error) => error.code === "AI_READ_CANCELLED");
});

test("invalid deadlines reject before the reader is called", async () => {
  let called = false;
  for (const timeoutMs of [0, 499, 30001, 1000.5, "1000"]) {
    await assert.rejects(withBoundedAiRead(() => { called = true; }, { timeoutMs }),
      (error) => error.code === "AI_READ_DEADLINE_INVALID");
  }
  assert.equal(called, false);
});

test("timed-out canonical metrics are marked failed with a minimal audit category", async () => {
  const events = { status: null, audits: [] };
  let observedReadSignal;
  const dependencies = {
    readMetrics: ({ signal }) => {
      observedReadSignal = signal;
      return new Promise(() => {});
    },
    runs: {
      create: async () => ({ _id: USER }),
      updateOne: async (_filter, update) => { events.status = update.$set.status; },
    },
    audits: {
      create: async (audit) => { events.audits.push(audit); },
    },
  };
  await assert.rejects(invokeGovernedBusinessMetrics({
    effectiveAuthority: authority,
    composition,
    user: { _id: USER },
    timeoutMs: 500,
  }, dependencies), (error) => error.code === "AI_READ_TIMEOUT");
  assert.equal(observedReadSignal.aborted, true);
  assert.equal(events.status, "failed");
  assert.equal(events.audits.length, 1);
  assert.equal(events.audits[0].after.failureCategory, "deadline");
  assert.equal(events.audits[0].after.metricCount, 0);
});

test("invalid invocation deadline never creates a run", async () => {
  let called = false;
  await assert.rejects(invokeGovernedBusinessMetrics({
    effectiveAuthority: authority,
    composition,
    user: { _id: USER },
    timeoutMs: 40000,
  }, {
    runs: { create: async () => { called = true; } },
  }));
  assert.equal(called, false);
});
