import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import AiActionOutcome from "../features/aiPlatform/AiActionOutcome.js";
import AiAgentRun from "../features/aiPlatform/AiAgentRun.js";
import AuditLog from "../models/AuditLog.js";
import { withAiOutcomeTransaction } from "../features/aiPlatform/aiOutcomeAtomicCommit.js";

const uri = process.env.AI_OUTCOME_TXN_ACCEPTANCE_URI;
// Destructive test data must never target an arbitrary or production database.
if (uri && uri !== "mongodb://127.0.0.1:27017/ai_outcome_txn_acceptance?replicaSet=rs0") {
  throw new Error("AI outcome acceptance requires its isolated local test database.");
}
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

test("real Mongoose outcome, agent-run update and audit validation roll back atomically", {
  skip: !uri ? "AI_OUTCOME_TXN_ACCEPTANCE_URI requires a local replica set" : false,
}, async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const business = new mongoose.Types.ObjectId();
  const actor = new mongoose.Types.ObjectId();
  const proposalId = new mongoose.Types.ObjectId();
  const run = await AiAgentRun.create({
    business, agentKey: "business-adviser", agentVersion: "1",
    initiatedBy: actor, initiatorType: "user",
    requestedAutonomy: "A0", effectiveAutonomy: "A0",
  });
  const createOutcome = (session) => AiActionOutcome.create([{
    business, proposal: proposalId, agentRun: run._id,
    status: "implemented", observedBy: actor, taskSuccess: true,
  }], { session });

  try {
    await assert.rejects(withAiOutcomeTransaction(async (session) => {
      await createOutcome(session);
      const updated = await AiAgentRun.updateOne(
        { _id: run._id, business },
        { $set: { "outcome.taskSuccess": true, "outcome.humanApproved": true } },
        { session },
      );
      assert.equal(updated.matchedCount, 1);
      // AuditLog.action is required. Validation failure must abort all writes.
      await AuditLog.create([{
        actor, resourceType: "AiActionProposal", resourceId: String(proposalId),
      }], { session });
    }), /action.*required/i);

    assert.equal(await AiActionOutcome.countDocuments({ business, proposal: proposalId }), 0);
    const rolledBackRun = await AiAgentRun.findById(run._id).lean();
    assert.equal(rolledBackRun.outcome.taskSuccess, null);
    assert.equal(rolledBackRun.outcome.humanApproved, null);
    assert.equal(await AuditLog.countDocuments({
      resourceType: "AiActionProposal", resourceId: String(proposalId),
    }), 0);

    await withAiOutcomeTransaction(async (session) => {
      await createOutcome(session);
      const updated = await AiAgentRun.updateOne(
        { _id: run._id, business },
        { $set: { "outcome.taskSuccess": true, "outcome.humanApproved": true } },
        { session },
      );
      assert.equal(updated.matchedCount, 1);
      await AuditLog.create([{
        actor, action: "ai_workforce.proposal_outcome_observed",
        resourceType: "AiActionProposal", resourceId: String(proposalId),
      }], { session });
    });

    assert.equal(await AiActionOutcome.countDocuments({ business, proposal: proposalId }), 1);
    const committedRun = await AiAgentRun.findById(run._id).lean();
    assert.equal(committedRun.outcome.taskSuccess, true);
    assert.equal(committedRun.outcome.humanApproved, true);
    assert.equal(await AuditLog.countDocuments({
      action: "ai_workforce.proposal_outcome_observed", resourceId: String(proposalId),
    }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
