import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import Lead from "../../models/Lead.js";
import LeadScore from "../../models/LeadScore.js";
import WorkflowDefinition from "../../models/WorkflowDefinition.js";
import AiActionProposal from "./AiActionProposal.js";
import AiAgentRun from "./AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "./aiWorkforceBuiltinAgents.js";
import {
  evaluateAgentToolPolicy,
} from "./aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "./aiWorkforceToolRegistry.js";
import {
  observeAiActionOutcome,
} from "./aiWorkforceGovernanceService.js";
import {
  getStoredRetentionPrediction,
  predictRetention,
} from "../ai/aiService.js";
import {
  hasEffectivePermission,
} from "../../services/effectiveAuthorityService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const DEFAULT_PROPOSAL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const PILOT_AGENT_KEYS = new Set(["ai-retention", "ai-lead"]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated AI pilot operator is required.", 401);
  }
  return value;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function assertTenantAuthority({ businessId, effectiveAuthority }) {
  objectId(businessId, "business");
  if (
    !effectiveAuthority ||
    String(effectiveAuthority.businessId || "") !== String(businessId)
  ) {
    throw createServiceError("Trusted tenant authority is required.", 403, {
      code: "AI_GROWTH_PILOT_TENANT_AUTHORITY_REQUIRED",
    });
  }
}

function assertPermission(effectiveAuthority, permission) {
  if (!hasEffectivePermission(effectiveAuthority, permission)) {
    throw createServiceError(
      `The AI pilot requires effective permission ${permission}.`,
      403,
      {
        code: "AI_GROWTH_PILOT_PERMISSION_REQUIRED",
        permission,
      }
    );
  }
}

function authoriseTool(agent, toolKey, autonomy, effectiveAuthority) {
  const tool = requireAiWorkforceTool(toolKey);
  const policy = evaluateAgentToolPolicy({
    agent,
    tool,
    requestedAutonomy: autonomy,
  });
  assertPermission(effectiveAuthority, tool.requiredPermission);
  return { tool, policy };
}

async function resolveWorkflow(payload, businessId) {
  const workflowId = text(payload?.workflowId);
  const workflowKey = text(payload?.workflowKey).toLowerCase();
  if (!workflowId && !workflowKey) {
    throw createServiceError(
      "An active governed workflowId or workflowKey is required for an AI growth pilot.",
      400,
      { field: "workflowKey" }
    );
  }

  const match = {
    business: businessId,
    status: "active",
  };
  if (workflowId) {
    match._id = objectId(workflowId, "workflowId");
  } else {
    match.key = workflowKey;
  }

  return assertFound(
    await WorkflowDefinition.findOne(match).lean(),
    "The requested active governed workflow was not found for this business."
  );
}

async function createPilotRun({
  businessId,
  locationId,
  user,
  requestId,
  agent,
  targetType,
  targetId,
  toolKeys,
}) {
  const now = new Date();
  return AiAgentRun.create({
    business: businessId,
    location: mongoose.isValidObjectId(locationId) ? locationId : null,
    agentKey: agent.key,
    agentVersion: agent.version,
    initiatorType: "user",
    initiatedBy: actorId(user),
    channel: "internal",
    requestedAutonomy: "A1",
    effectiveAutonomy: "A1",
    status: "started",
    toolInvocations: toolKeys.map(({ tool, autonomy }) => ({
      toolKey: tool.key,
      requiredPermission: tool.requiredPermission,
      riskLevel: tool.riskLevel,
      status: "allowed",
      evidenceRefs: [],
      startedAt: now,
    })),
    startedAt: now,
    requestId: text(requestId),
    metadata: {
      pilot: agent.key === "ai-retention" ? "retention" : "lead",
      targetType,
      targetId: String(targetId),
      proposalOnly: true,
      automaticExecution: false,
    },
  });
}

function completeInvocation(run, toolKey, evidenceRefs = []) {
  const invocation = run.toolInvocations.find((item) => item.toolKey === toolKey);
  if (!invocation) return;
  invocation.status = "completed";
  invocation.completedAt = new Date();
  invocation.evidenceRefs = [...new Set(evidenceRefs.map(text).filter(Boolean))];
}

function failRun(run, error) {
  run.status = "failed";
  run.completedAt = new Date();
  run.latencyMs = Math.max(0, run.completedAt.getTime() - run.startedAt.getTime());
  run.metadata = {
    ...(run.metadata || {}),
    failureCode: text(error?.code || "AI_GROWTH_PILOT_FAILED"),
    failureReason: text(error?.message || "AI growth pilot failed.").slice(0, 1000),
  };
  for (const invocation of run.toolInvocations) {
    if (["allowed", "completed"].includes(invocation.status)) {
      if (invocation.status !== "completed") invocation.status = "failed";
      if (!invocation.completedAt) invocation.completedAt = new Date();
    }
  }
}

async function createWorkflowProposal({
  businessId,
  locationId,
  user,
  run,
  agent,
  workflow,
  actionType,
  targetType,
  targetId,
  summary,
  rationale,
  proposedChanges,
  evidenceRefs,
  metricKey,
}) {
  const proposalTool = requireAiWorkforceTool("workflow.enrolment.propose");
  const proposal = await AiActionProposal.create({
    business: businessId,
    location: mongoose.isValidObjectId(locationId) ? locationId : undefined,
    agentRun: run._id,
    agentKey: agent.key,
    autonomyLevel: "A1",
    riskLevel: proposalTool.riskLevel,
    evidenceRefs,
    rollbackPlan:
      "No automatic execution occurs. Rejecting or allowing this proposal to expire requires no rollback; any later workflow action remains governed by its own controls.",
    createdBy: actorId(user),
    actionType,
    domain: "workflow",
    requiredPermission: proposalTool.requiredPermission,
    targetType,
    targetId: String(targetId),
    contextPath: `/future/workflows/${workflow._id}`,
    summary,
    rationale,
    proposedChanges: {
      workflowId: String(workflow._id),
      workflowKey: workflow.key,
      workflowVersion: workflow.version,
      ...proposedChanges,
      measurement: {
        metricKey,
        conversionWindowStartsAt: new Date().toISOString(),
      },
    },
    status: "pending",
    expiresAt: new Date(Date.now() + DEFAULT_PROPOSAL_EXPIRY_MS),
    executionStatus: "blocked",
    executionBlockedReason:
      "AI Retention/Lead pilots are proposal-only. Human review does not automatically execute workflow enrolment.",
  });

  run.proposalIds.push(proposal._id);
  completeInvocation(run, "workflow.enrolment.propose", [
    `workflow:${workflow._id}`,
    `proposal:${proposal._id}`,
  ]);
  return proposal;
}

async function auditProposal({ businessId, user, requestId, run, proposal }) {
  await AuditLog.create({
    actor: actorId(user),
    action: "ai_workforce.growth_pilot_proposal_created",
    resourceType: "AiActionProposal",
    resourceId: String(proposal._id),
    requestId: text(requestId),
    after: {
      agentKey: proposal.agentKey,
      actionType: proposal.actionType,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      status: proposal.status,
    },
    metadata: {
      businessId: String(businessId),
      agentRunId: String(run._id),
      autonomyLevel: "A1",
      automaticExecution: false,
      proposalOnly: true,
    },
  });
}

async function finishRun(run, metadata = {}) {
  run.status = "completed";
  run.completedAt = new Date();
  run.latencyMs = Math.max(0, run.completedAt.getTime() - run.startedAt.getTime());
  run.outcome.taskSuccess = true;
  run.outcome.policyViolation = false;
  run.metadata = {
    ...(run.metadata || {}),
    ...metadata,
  };
  await run.save();
}

export async function runRetentionGrowthPilot(
  payload = {},
  {
    businessId,
    locationId = null,
    effectiveAuthority,
    user,
    requestId = "",
  } = {}
) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  const customerId = objectId(payload.customerId, "customerId");
  const customer = assertFound(
    await Customer.findOne({
      _id: customerId,
      business: businessId,
      status: { $ne: "deleted" },
    }).lean(),
    "Tenant-owned customer not found."
  );
  const workflow = await resolveWorkflow(payload, businessId);
  const agent = getBuiltinAiAgentDefinition("ai-retention");
  const read = authoriseTool(agent, "retention.risk.read", "A0", effectiveAuthority);
  const propose = authoriseTool(
    agent,
    "workflow.enrolment.propose",
    "A1",
    effectiveAuthority
  );
  const run = await createPilotRun({
    businessId,
    locationId,
    user,
    requestId,
    agent,
    targetType: "customer",
    targetId: customer._id,
    toolKeys: [
      { tool: read.tool, autonomy: "A0" },
      { tool: propose.tool, autonomy: "A1" },
    ],
  });

  try {
    const prediction = payload.forcePrediction === true
      ? await predictRetention(customer._id, { force: true })
      : await getStoredRetentionPrediction(customer._id);
    if (!prediction) {
      throw createServiceError(
        "A current retention prediction is required. Set forcePrediction=true to refresh it.",
        409,
        { code: "AI_RETENTION_PREDICTION_REQUIRED" }
      );
    }

    const score = boundedNumber(prediction.score, 0, 0, 1);
    const threshold = boundedNumber(payload.minimumRiskScore, 0.55, 0, 1);
    const predictionId = prediction._id || prediction.id || "";
    const evidenceRefs = [
      `customer:${customer._id}`,
      predictionId ? `retention-prediction:${predictionId}` : "",
    ].filter(Boolean);
    completeInvocation(run, "retention.risk.read", evidenceRefs);

    if (score < threshold) {
      completeInvocation(run, "workflow.enrolment.propose", [
        `workflow:${workflow._id}`,
      ]);
      await finishRun(run, {
        proposalCreated: false,
        reason: "below_risk_threshold",
        riskScore: score,
        minimumRiskScore: threshold,
        workflowId: String(workflow._id),
      });
      return {
        run: run.toObject(),
        proposal: null,
        assessment: {
          score,
          label: prediction.label || "",
          threshold,
          proposalCreated: false,
        },
      };
    }

    const proposal = await createWorkflowProposal({
      businessId,
      locationId,
      user,
      run,
      agent,
      workflow,
      actionType: "retention.workflow_enrolment_review",
      targetType: "customer",
      targetId: customer._id,
      summary: `Review retention workflow enrolment for customer ${customer._id}.`,
      rationale:
        text(prediction.explanation) ||
        `Canonical retention risk score ${score.toFixed(3)} met the ${threshold.toFixed(3)} pilot threshold.`,
      proposedChanges: {
        customerId: String(customer._id),
        riskScore: score,
        riskLabel: text(prediction.label),
        sourcePredictionId: predictionId ? String(predictionId) : "",
        communicationAuthority: "workflow_policy_and_consent_required",
      },
      evidenceRefs,
      metricKey: "retention.rebooking_conversion",
    });
    await auditProposal({ businessId, user, requestId, run, proposal });
    await finishRun(run, {
      proposalCreated: true,
      riskScore: score,
      minimumRiskScore: threshold,
      workflowId: String(workflow._id),
      proposalId: String(proposal._id),
    });

    return {
      run: run.toObject(),
      proposal: proposal.toObject(),
      assessment: {
        score,
        label: prediction.label || "",
        threshold,
        proposalCreated: true,
      },
    };
  } catch (error) {
    failRun(run, error);
    await run.save();
    throw error;
  }
}

export async function runLeadGrowthPilot(
  leadId,
  payload = {},
  {
    businessId,
    locationId = null,
    effectiveAuthority,
    user,
    requestId = "",
  } = {}
) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  objectId(leadId, "leadId");
  const lead = assertFound(
    await Lead.findOne({ _id: leadId, business: businessId }).lean(),
    "Tenant-owned lead not found."
  );
  const workflow = await resolveWorkflow(payload, businessId);
  const agent = getBuiltinAiAgentDefinition("ai-lead");
  const read = authoriseTool(agent, "lead.score.read", "A0", effectiveAuthority);
  const propose = authoriseTool(
    agent,
    "workflow.enrolment.propose",
    "A1",
    effectiveAuthority
  );
  const run = await createPilotRun({
    businessId,
    locationId: lead.location || locationId,
    user,
    requestId,
    agent,
    targetType: "lead",
    targetId: lead._id,
    toolKeys: [
      { tool: read.tool, autonomy: "A0" },
      { tool: propose.tool, autonomy: "A1" },
    ],
  });

  try {
    const snapshot = assertFound(
      await LeadScore.findOne({
        business: businessId,
        lead: lead._id,
      })
        .sort({ createdAt: -1, _id: -1 })
        .lean(),
      "A canonical LeadScore snapshot is required before running the AI Lead pilot."
    );
    const score = boundedNumber(snapshot.score, 0, 0, 100);
    const threshold = boundedNumber(payload.minimumLeadScore, 40, 0, 100);
    const evidenceRefs = [
      `lead:${lead._id}`,
      `lead-score:${snapshot._id}`,
    ];
    completeInvocation(run, "lead.score.read", evidenceRefs);

    if (["converted", "disqualified", "lost"].includes(lead.status)) {
      completeInvocation(run, "workflow.enrolment.propose", [
        `workflow:${workflow._id}`,
      ]);
      await finishRun(run, {
        proposalCreated: false,
        reason: `lead_status_${lead.status}`,
        leadScore: score,
        workflowId: String(workflow._id),
      });
      return {
        run: run.toObject(),
        proposal: null,
        assessment: {
          score,
          band: snapshot.band || lead.scoreBand,
          threshold,
          proposalCreated: false,
        },
      };
    }

    if (score < threshold) {
      completeInvocation(run, "workflow.enrolment.propose", [
        `workflow:${workflow._id}`,
      ]);
      await finishRun(run, {
        proposalCreated: false,
        reason: "below_lead_score_threshold",
        leadScore: score,
        minimumLeadScore: threshold,
        workflowId: String(workflow._id),
      });
      return {
        run: run.toObject(),
        proposal: null,
        assessment: {
          score,
          band: snapshot.band || lead.scoreBand,
          threshold,
          proposalCreated: false,
        },
      };
    }

    const proposal = await createWorkflowProposal({
      businessId,
      locationId: lead.location || locationId,
      user,
      run,
      agent,
      workflow,
      actionType: "lead.workflow_enrolment_review",
      targetType: "lead",
      targetId: lead._id,
      summary: `Review nurture workflow enrolment for lead ${lead._id}.`,
      rationale:
        text(snapshot.explanation) ||
        `Canonical lead score ${score}/100 met the ${threshold}/100 pilot threshold.`,
      proposedChanges: {
        leadId: String(lead._id),
        leadScore: score,
        scoreBand: snapshot.band || lead.scoreBand,
        scoreMethod: snapshot.method,
        scoreVersion: snapshot.version,
        sourceLeadScoreId: String(snapshot._id),
        proposedNurtureStatus: "enrolled",
        communicationAuthority: "workflow_policy_and_consent_required",
      },
      evidenceRefs,
      metricKey: "lead.customer_conversion",
    });
    await auditProposal({ businessId, user, requestId, run, proposal });
    await finishRun(run, {
      proposalCreated: true,
      leadScore: score,
      minimumLeadScore: threshold,
      workflowId: String(workflow._id),
      proposalId: String(proposal._id),
    });

    return {
      run: run.toObject(),
      proposal: proposal.toObject(),
      assessment: {
        score,
        band: snapshot.band || lead.scoreBand,
        threshold,
        proposalCreated: true,
      },
    };
  } catch (error) {
    failRun(run, error);
    await run.save();
    throw error;
  }
}

export async function measureAiGrowthPilotProposal(
  proposalId,
  payload = {},
  context = {}
) {
  const { businessId, effectiveAuthority } = context;
  assertTenantAuthority({ businessId, effectiveAuthority });
  objectId(proposalId, "proposalId");
  const proposal = assertFound(
    await AiActionProposal.findOne({
      _id: proposalId,
      business: businessId,
      agentKey: { $in: [...PILOT_AGENT_KEYS] },
    }).lean(),
    "AI Retention/Lead pilot proposal not found."
  );

  if (payload.implemented !== true) {
    return observeAiActionOutcome(
      proposalId,
      {
        status: "not_implemented",
        taskSuccess: false,
        evidenceRefs: [`proposal:${proposalId}`],
        note: text(payload.note || "Pilot proposal was not implemented."),
        metadata: {
          measurementSource: "ai-growth-pilot",
          automaticExecution: false,
        },
      },
      context
    );
  }

  const windowStart = proposal.reviewedAt || proposal.createdAt;
  let converted = false;
  let metricKey = "";
  const evidenceRefs = [`proposal:${proposal._id}`];

  if (proposal.agentKey === "ai-retention") {
    const customer = assertFound(
      await Customer.findOne({
        _id: objectId(proposal.targetId, "customer"),
        business: businessId,
        status: { $ne: "deleted" },
      }).lean(),
      "Pilot customer not found."
    );
    const appointment = await Appointment.findOne({
      customer: customer._id,
      createdAt: { $gte: windowStart },
      status: { $ne: "cancelled" },
    })
      .sort({ createdAt: 1, _id: 1 })
      .select("_id status createdAt")
      .lean();
    converted = Boolean(appointment);
    metricKey = "retention.rebooking_conversion";
    evidenceRefs.push(`customer:${customer._id}`);
    if (appointment) evidenceRefs.push(`appointment:${appointment._id}`);
  } else if (proposal.agentKey === "ai-lead") {
    const lead = assertFound(
      await Lead.findOne({
        _id: objectId(proposal.targetId, "lead"),
        business: businessId,
      }).lean(),
      "Pilot lead not found."
    );
    converted =
      lead.status === "converted" &&
      Boolean(lead.customer) &&
      Boolean(lead.convertedAt) &&
      new Date(lead.convertedAt) >= new Date(windowStart);
    metricKey = "lead.customer_conversion";
    evidenceRefs.push(`lead:${lead._id}`);
    if (lead.customer) evidenceRefs.push(`customer:${lead.customer}`);
  }

  return observeAiActionOutcome(
    proposalId,
    {
      status: "implemented",
      taskSuccess: converted,
      businessMetricKey: metricKey,
      businessMetricDelta: converted ? 1 : 0,
      evidenceRefs,
      note:
        text(payload.note) ||
        (converted
          ? "Governed pilot conversion evidence was observed."
          : "The pilot was implemented, but no conversion evidence is recorded yet."),
      metadata: {
        measurementSource: "ai-growth-pilot",
        conversionObserved: converted,
        conversionWindowStartsAt: windowStart,
        automaticExecution: false,
      },
    },
    context
  );
}

export default {
  measureAiGrowthPilotProposal,
  runLeadGrowthPilot,
  runRetentionGrowthPilot,
};
