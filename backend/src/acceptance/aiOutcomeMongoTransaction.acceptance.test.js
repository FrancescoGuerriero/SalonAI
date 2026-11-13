import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { withAiOutcomeTransaction } from "../features/aiPlatform/aiOutcomeAtomicCommit.js";

const uri = process.env.AI_OUTCOME_TXN_ACCEPTANCE_URI;
test("real replica set rolls back AI outcome, run and audit writes together", {
  skip: !uri ? "AI_OUTCOME_TXN_ACCEPTANCE_URI requires a local replica set" : false,
}, async () => {
  const connection = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try {
    const outcomes = connection.collection("ai_outcome_txn_test_outcomes");
    const runs = connection.collection("ai_outcome_txn_test_runs");
    const audits = connection.collection("ai_outcome_txn_test_audits");
    await Promise.all([outcomes.deleteMany({}), runs.deleteMany({}), audits.deleteMany({})]);

    const startSession = () => connection.startSession();
    await assert.rejects(withAiOutcomeTransaction(async (session) => {
      await outcomes.insertOne({ caseId: "abort-audit" }, { session });
      await runs.insertOne({ caseId: "abort-audit" }, { session });
      await audits.insertOne({ caseId: "abort-audit" }, { session });
      throw new Error("audit write rejected");
    }, { startSession }), /audit write rejected/);

    for (const collection of [outcomes, runs, audits]) {
      assert.equal(await collection.countDocuments({ caseId: "abort-audit" }), 0);
    }

    const result = await withAiOutcomeTransaction(async (session) => {
      await outcomes.insertOne({ caseId: "committed" }, { session });
      await runs.insertOne({ caseId: "committed" }, { session });
      await audits.insertOne({ caseId: "committed" }, { session });
      return "committed";
    }, { startSession });
    assert.equal(result, "committed");
    for (const collection of [outcomes, runs, audits]) {
      assert.equal(await collection.countDocuments({ caseId: "committed" }), 1);
    }
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
