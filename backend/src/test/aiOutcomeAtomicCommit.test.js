import assert from "node:assert/strict";
import test from "node:test";
import { withAiOutcomeTransaction } from "../features/aiPlatform/aiOutcomeAtomicCommit.js";

function sessionFixture({ failCommit = false } = {}) {
  const events = [];
  const session = {
    async withTransaction(callback) {
      events.push("begin");
      try {
        await callback();
        if (failCommit) throw new Error("commit failed");
        events.push("commit");
      } catch (error) {
        events.push("abort");
        throw error;
      }
    },
    async endSession() { events.push("end"); },
  };
  return { events, startSession: async () => session, session };
}

test("AI outcome session commits after all three writes", async () => {
  const fixture = sessionFixture();
  const result = await withAiOutcomeTransaction(async (session) => {
    assert.equal(session, fixture.session);
    fixture.events.push("outcome", "agent-run", "audit");
    return { outcomeId: "saved" };
  }, fixture);
  assert.deepEqual(result, { outcomeId: "saved" });
  assert.deepEqual(fixture.events,
    ["begin", "outcome", "agent-run", "audit", "commit", "end"]);
});

test("AI outcome session aborts when audit or agent-run update fails", async () => {
  for (const failedStep of ["agent-run", "audit"]) {
    const fixture = sessionFixture();
    await assert.rejects(withAiOutcomeTransaction(async () => {
      fixture.events.push("outcome");
      if (failedStep === "agent-run") throw new Error("run update failed");
      fixture.events.push("agent-run");
      throw new Error("audit insert failed");
    }, fixture), /failed/);
    assert.ok(fixture.events.includes("abort"));
    assert.ok(!fixture.events.includes("commit"));
    assert.equal(fixture.events.at(-1), "end");
  }
});

test("AI outcome transaction rejects unsupported sessions without executing work", async () => {
  let called = false;
  await assert.rejects(withAiOutcomeTransaction(async () => {
    called = true;
  }, { startSession: async () => ({ endSession: async () => {} }) }),
  (error) => error.details?.code === "AI_OUTCOME_TRANSACTION_UNAVAILABLE");
  assert.equal(called, false);
  await assert.rejects(withAiOutcomeTransaction(null),
    (error) => error.details?.code === "AI_OUTCOME_TRANSACTION_INVALID");
});

test("AI outcome transaction propagates commit failure and closes session", async () => {
  const fixture = sessionFixture({ failCommit: true });
  await assert.rejects(withAiOutcomeTransaction(() => "outcome", fixture),
    /commit failed/);
  assert.deepEqual(fixture.events, ["begin", "abort", "end"]);
});
