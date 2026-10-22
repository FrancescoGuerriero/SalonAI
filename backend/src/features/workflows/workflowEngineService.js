import os from "node:os";
import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import DomainEvent from "../../models/DomainEvent.js";
import TriggerDefinition from "../../models/TriggerDefinition.js";
import WorkflowAction, {
  WORKFLOW_ACTION_TYPES,
} from "../../models/WorkflowAction.js";
import WorkflowDefinition, {
  WORKFLOW_STATUSES,
} from "../../models/WorkflowDefinition.js";
import WorkflowRun from "../../models/WorkflowRun.js";
import ScheduledCommunication from "../scheduler/ScheduledCommunication.js";
import {
  addLeadTimelineEvent,
  scoreLead,
  setLeadNurture,
} from "../leads/leadService.js";
import {
  domainEventDefinition,
} from "../integrationPlatform/domainEventCatalogue.js";
import {
  evaluateWorkflowConditions,
  interpolateWorkflowText,
  valueAtPath,
} from "./workflowConditionEvaluator.js";
import {
  assertWorkflowCommunicationAllowed,
} from "./workflowCommunicationPolicy.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const workerId = `${os.hostname()}_${process.pid}`;
const MAX_ACTIONS_PER_EXECUTION = 50;

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

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function positiveInteger(value, fallback = 1, max = 1000000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function enumValue(value, field, allowed, fallback) {
  const result = text(value || fallback).toLowerCase().replaceAll("-", "_");
  if (!allowed.includes(result)) {
    throw createServiceError(`${field} must be one of: ${allowed.join(", ")}.`, 400, {
      field,
    });
  }
  return result;
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => text(value).toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function delayMilliseconds(configuration = {}) {
  const seconds = Number(configuration.seconds || 0);
  const minutes = Number(configuration.minutes || 0);
  const hours = Number(configuration.hours || 0);
  const days = Number(configuration.days || 0);
  const milliseconds =
    Math.max(0, seconds) * 1000 +
    Math.max(0, minutes) * 60 * 1000 +
    Math.max(0, hours) * 60 * 60 * 1000 +
    Math.max(0, days) * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw createServiceError(
      "Delay actions require a positive seconds, minutes, hours or days value.",
      400
    );
  }
  return milliseconds;
}

function eventContext(event) {
  return {
    event: {
      eventId: event.eventId,
      type: event.type,
      version: event.version,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
      payload: event.payload || {},
      metadata: event.metadata || {},
      correlationId: event.correlationId || "",
    },
  };
}

function resolveConfigurationValue(configuration, valueKey, pathKey, context) {
  const path = text(configuration?.[pathKey]);
  if (path) return valueAtPath(context, path);
  return configuration?.[valueKey];
}

function validateWorkflowGraph(startActionKey, actions = []) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw createServiceError("A workflow requires at least one action.", 400, {
      field: "actions",
    });
  }

  const keys = actions.map((action) => text(action.key));
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
    throw createServiceError("Workflow action keys must be non-empty and unique.", 400, {
      field: "actions",
    });
  }
  if (!keys.includes(startActionKey)) {
    throw createServiceError("startActionKey must reference an existing action.", 400, {
      field: "startActionKey",
    });
  }

  const keySet = new Set(keys);
  for (const action of actions) {
    const actionType = enumValue(
      action.actionType,
      "actionType",
      WORKFLOW_ACTION_TYPES,
      "noop"
    );
    for (const pointer of [
      action.nextActionKey,
      action.trueActionKey,
      action.falseActionKey,
    ]) {
      if (text(pointer) && !keySet.has(text(pointer))) {
        throw createServiceError(
          `Workflow action ${action.key} points to missing action ${pointer}.`,
          400,
          { field: "actions" }
        );
      }
    }
    if (actionType === "delay") {
      delayMilliseconds(action.configuration || {});
    }
    if (
      actionType === "branch" &&
      (!text(action.trueActionKey) || !text(action.falseActionKey))
    ) {
      throw createServiceError(
        `Branch action ${action.key} requires trueActionKey and falseActionKey.`,
        400,
        { field: "actions" }
      );
    }
  }
}

function normalisePolicy(policy = {}) {
  return {
    failClosed: policy.failClosed !== false,
    communicationClassification: enumValue(
      policy.communicationClassification,
      "policy.communicationClassification",
      ["none", "transactional", "marketing"],
      "none"
    ),
    allowedChannels: uniqueStrings(policy.allowedChannels),
  };
}

export async function createWorkflowDefinition(
  payload = {},
  { businessId } = {}
) {
  objectId(businessId, "business");
  const name = text(payload.name);
  const key = slug(payload.key || name);
  const version = positiveInteger(payload.version, 1, 100000);
  const status = enumValue(
    payload.status,
    "status",
    WORKFLOW_STATUSES,
    "draft"
  );
  const startActionKey = text(payload.startActionKey || payload.actions?.[0]?.key);
  validateWorkflowGraph(startActionKey, payload.actions);

  if (!name || !key) {
    throw createServiceError("Workflow name is required.", 400, { field: "name" });
  }
  if (!Array.isArray(payload.triggers) || payload.triggers.length === 0) {
    throw createServiceError("A workflow requires at least one trigger.", 400, {
      field: "triggers",
    });
  }

  for (const trigger of payload.triggers) {
    domainEventDefinition(trigger.eventType, trigger.eventVersion || "1");
  }

  const session = await mongoose.startSession();
  let workflowId = null;
  try {
    await session.withTransaction(async () => {
      const [workflow] = await WorkflowDefinition.create(
        [
          {
            business: businessId,
            key,
            name,
            description: text(payload.description),
            version,
            status,
            startActionKey,
            policy: normalisePolicy(payload.policy),
            metadata: payload.metadata || {},
          },
        ],
        { session }
      );
      workflowId = workflow._id;

      await TriggerDefinition.create(
        payload.triggers.map((trigger) => ({
          business: businessId,
          workflow: workflow._id,
          type: "domain_event",
          eventType: text(trigger.eventType).toLowerCase(),
          eventVersion: text(trigger.eventVersion || "1"),
          conditions: Array.isArray(trigger.conditions) ? trigger.conditions : [],
          status: trigger.status === "disabled" ? "disabled" : "active",
          metadata: trigger.metadata || {},
        })),
        { session }
      );

      await WorkflowAction.create(
        payload.actions.map((action, index) => ({
          business: businessId,
          workflow: workflow._id,
          key: text(action.key),
          actionType: enumValue(
            action.actionType,
            "actionType",
            WORKFLOW_ACTION_TYPES,
            "noop"
          ),
          position: Number.isFinite(Number(action.position))
            ? Math.max(0, Number(action.position))
            : index,
          configuration: action.configuration || {},
          nextActionKey: text(action.nextActionKey),
          trueActionKey: text(action.trueActionKey),
          falseActionKey: text(action.falseActionKey),
        })),
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return getWorkflowDefinition(workflowId, { businessId });
}

export async function listWorkflowDefinitions(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) {
    match.status = enumValue(query.status, "status", WORKFLOW_STATUSES, "active");
  }
  if (query.key) match.key = slug(query.key);
  return WorkflowDefinition.find(match)
    .sort({ key: 1, version: -1 })
    .lean();
}

export async function getWorkflowDefinition(workflowId, { businessId } = {}) {
  objectId(workflowId, "workflow");
  objectId(businessId, "business");
  const workflow = assertFound(
    await WorkflowDefinition.findOne({ _id: workflowId, business: businessId }).lean(),
    "Workflow not found."
  );
  const [triggers, actions] = await Promise.all([
    TriggerDefinition.find({ business: businessId, workflow: workflowId })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    WorkflowAction.find({ business: businessId, workflow: workflowId })
      .sort({ position: 1, _id: 1 })
      .lean(),
  ]);
  return { workflow, triggers, actions };
}

export async function setWorkflowStatus(
  workflowId,
  requestedStatus,
  { businessId } = {}
) {
  objectId(workflowId, "workflow");
  objectId(businessId, "business");
  const status = enumValue(
    requestedStatus,
    "status",
    WORKFLOW_STATUSES,
    "draft"
  );
  const workflow = assertFound(
    await WorkflowDefinition.findOne({ _id: workflowId, business: businessId }),
    "Workflow not found."
  );
  workflow.status = status;
  await workflow.save();
  return workflow.toObject();
}

export async function dispatchDomainEventToWorkflows(
  eventId,
  { execute = true } = {}
) {
  const event = assertFound(
    await DomainEvent.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(eventId) ? eventId : undefined },
        { eventId: text(eventId) },
      ].filter((item) => Object.values(item)[0] !== undefined),
    }),
    "Domain event not found."
  );
  const context = eventContext(event);
  const triggers = await TriggerDefinition.find({
    business: event.business,
    type: "domain_event",
    eventType: event.type,
    eventVersion: event.version,
    status: "active",
  })
    .populate({ path: "workflow", match: { status: "active" } })
    .lean();

  const runs = [];
  for (const trigger of triggers) {
    if (!trigger.workflow) continue;
    if (!evaluateWorkflowConditions(trigger.conditions, context)) continue;
    const idempotencyKey = `event:${event.eventId}:workflow:${trigger.workflow._id}`;
    const run = await WorkflowRun.findOneAndUpdate(
      { business: event.business, idempotencyKey },
      {
        $setOnInsert: {
          business: event.business,
          workflow: trigger.workflow._id,
          trigger: trigger._id,
          domainEvent: event._id,
          sourceEventId: event.eventId,
          idempotencyKey,
          status: "pending",
          currentActionKey: trigger.workflow.startActionKey,
          context,
          history: [
            {
              status: "pending",
              message: `Workflow triggered by ${event.type}@${event.version}.`,
              metadata: { eventId: event.eventId },
            },
          ],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    runs.push(run);
  }

  event.workflowDispatchedAt = new Date();
  await event.save();

  if (execute) {
    for (const run of runs) {
      if (["pending", "waiting"].includes(run.status)) {
        await executeWorkflowRun(run._id);
      }
    }
  }

  return runs.map((run) =>
    typeof run.toObject === "function" ? run.toObject() : run
  );
}

async function executeCommunicationAction(run, workflow, action) {
  const configuration = action.configuration || {};
  const customerId = resolveConfigurationValue(
    configuration,
    "customerId",
    "customerIdPath",
    run.context
  );
  objectId(customerId, "customer");
  const customer = assertFound(
    await Customer.findOne({
      _id: customerId,
      business: run.business,
      status: { $ne: "deleted" },
    }),
    "Workflow communication customer not found in the active business."
  );

  const channel = text(configuration.channel).toLowerCase();
  const classification = text(
    configuration.classification ||
      workflow.policy?.communicationClassification ||
      "transactional"
  ).toLowerCase();
  const policy = assertWorkflowCommunicationAllowed(customer, {
    channel,
    classification,
    allowedChannels: workflow.policy?.allowedChannels || [],
  });
  const executionKey = `workflow:${run._id}:action:${action.key}`;

  const existing = await ScheduledCommunication.findOne({
    business: run.business,
    "metadata.workflowExecutionKey": executionKey,
  }).lean();
  if (existing) return existing;

  const scheduledFor = new Date(
    Date.now() + Math.max(0, Number(configuration.delaySeconds) || 0) * 1000
  );
  const message = interpolateWorkflowText(configuration.message, run.context);
  if (!message) {
    throw createServiceError("Workflow communication message is required.", 400);
  }

  return (
    await ScheduledCommunication.create({
      business: run.business,
      location: resolveConfigurationValue(
        configuration,
        "locationId",
        "locationIdPath",
        run.context
      ) || undefined,
      customer: customer._id,
      communicationType: text(configuration.communicationType || "general"),
      channel: policy.channel,
      recipient: policy.recipient,
      subject: interpolateWorkflowText(configuration.subject, run.context),
      message,
      scheduledFor,
      status: "queued",
      metadata: {
        workflowExecutionKey: executionKey,
        workflowRunId: String(run._id),
        workflowId: String(workflow._id),
        workflowKey: workflow.key,
        actionKey: action.key,
        sourceEventId: run.sourceEventId,
        classification: policy.classification,
      },
    })
  ).toObject();
}

async function executeRegisteredAction(run, workflow, action) {
  const configuration = action.configuration || {};
  const leadId = resolveConfigurationValue(
    configuration,
    "leadId",
    "leadIdPath",
    run.context
  );

  switch (action.actionType) {
    case "noop":
      return { noop: true };
    case "lead.timeline": {
      objectId(leadId, "lead");
      const executionKey = `workflow:${run._id}:action:${action.key}`;
      return addLeadTimelineEvent(
        leadId,
        {
          type: configuration.type || "note",
          channel: configuration.channel,
          summary: interpolateWorkflowText(configuration.summary, run.context),
          metadata: {
            ...(configuration.metadata || {}),
            workflowExecutionKey: executionKey,
            workflowRunId: String(run._id),
          },
        },
        { businessId: String(run.business) }
      );
    }
    case "lead.score":
      objectId(leadId, "lead");
      return scoreLead(
        leadId,
        {
          method: configuration.method || "rules",
          score: resolveConfigurationValue(
            configuration,
            "score",
            "scorePath",
            run.context
          ),
          explanation: interpolateWorkflowText(
            configuration.explanation,
            run.context
          ),
          version: configuration.version || "workflow-v1",
          factors: configuration.factors || [],
          features: configuration.features || {},
        },
        { businessId: String(run.business) }
      );
    case "lead.nurture":
      objectId(leadId, "lead");
      return setLeadNurture(
        leadId,
        {
          workflowKey: configuration.workflowKey || workflow.key,
          status: configuration.status || "enrolled",
          nextActionAt:
            configuration.nextActionAt ||
            resolveConfigurationValue(
              configuration,
              "nextActionAt",
              "nextActionAtPath",
              run.context
            ),
        },
        { businessId: String(run.business) }
      );
    case "communication.enqueue":
      return executeCommunicationAction(run, workflow, action);
    default:
      throw createServiceError(
        `Workflow action type ${action.actionType} is not executable.`,
        400
      );
  }
}

function history(run, status, actionKey, message, metadata = {}) {
  run.history.push({
    at: new Date(),
    status,
    actionKey: actionKey || "",
    message,
    metadata,
  });
}

export async function executeWorkflowRun(runId) {
  objectId(runId, "workflowRun");
  const now = new Date();
  const run = await WorkflowRun.findOneAndUpdate(
    {
      _id: runId,
      $or: [
        { status: "pending" },
        { status: "waiting", nextRunAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "running",
        lockedAt: now,
        lockedBy: workerId,
        startedAt: now,
        nextRunAt: null,
      },
    },
    { new: true }
  );
  if (!run) return null;

  const workflow = await WorkflowDefinition.findOne({
    _id: run.workflow,
    business: run.business,
  }).lean();
  if (!workflow || workflow.status !== "active") {
    run.status = "blocked";
    run.failureCode = "WORKFLOW_NOT_ACTIVE";
    run.failureReason = "Workflow is not active.";
    run.lockedAt = null;
    run.lockedBy = "";
    history(run, "blocked", run.currentActionKey, run.failureReason);
    await run.save();
    return run.toObject();
  }

  const actions = await WorkflowAction.find({
    business: run.business,
    workflow: workflow._id,
  }).lean();
  const actionByKey = new Map(actions.map((action) => [action.key, action]));

  try {
    for (let step = 0; step < MAX_ACTIONS_PER_EXECUTION; step += 1) {
      const actionKey = text(run.currentActionKey);
      if (!actionKey) {
        run.status = "completed";
        run.completedAt = new Date();
        run.lockedAt = null;
        run.lockedBy = "";
        history(run, "completed", "", "Workflow completed.");
        await run.save();
        return run.toObject();
      }

      const action = actionByKey.get(actionKey);
      if (!action) {
        throw createServiceError(
          `Workflow action ${actionKey} is missing.`,
          500,
          { actionKey }
        );
      }

      if (action.actionType === "delay") {
        const delay = delayMilliseconds(action.configuration || {});
        run.currentActionKey = text(action.nextActionKey);
        run.status = "waiting";
        run.nextRunAt = new Date(Date.now() + delay);
        run.lockedAt = null;
        run.lockedBy = "";
        if (!run.completedActionKeys.includes(action.key)) {
          run.completedActionKeys.push(action.key);
        }
        history(run, "waiting", action.key, "Workflow delayed.", {
          nextRunAt: run.nextRunAt,
        });
        await run.save();
        return run.toObject();
      }

      if (action.actionType === "branch") {
        const matched = evaluateWorkflowConditions(
          action.configuration?.conditions || [],
          run.context,
          action.configuration?.mode || "all"
        );
        const selectedKey = matched
          ? text(action.trueActionKey)
          : text(action.falseActionKey);
        run.currentActionKey = selectedKey;
        if (!run.completedActionKeys.includes(action.key)) {
          run.completedActionKeys.push(action.key);
        }
        history(run, "running", action.key, "Workflow branch evaluated.", {
          matched,
          selectedActionKey: selectedKey,
        });
        await run.save();
        continue;
      }

      const outcome = await executeRegisteredAction(run, workflow, action);
      if (!run.completedActionKeys.includes(action.key)) {
        run.completedActionKeys.push(action.key);
      }
      run.currentActionKey = text(action.nextActionKey);
      history(run, "running", action.key, "Workflow action completed.", {
        outcomeId: outcome?._id ? String(outcome._id) : "",
      });
      await run.save();
    }

    throw createServiceError(
      `Workflow exceeded ${MAX_ACTIONS_PER_EXECUTION} actions in one execution.`,
      409,
      { code: "WORKFLOW_ACTION_LIMIT_EXCEEDED" }
    );
  } catch (error) {
    run.status =
      error?.code === "WORKFLOW_COMMUNICATION_POLICY_BLOCKED"
        ? "blocked"
        : "failed";
    run.failureCode = text(error?.code || error?.details?.code || "WORKFLOW_ACTION_FAILED");
    run.failureReason = text(error?.message || "Workflow action failed.");
    run.lockedAt = null;
    run.lockedBy = "";
    history(
      run,
      run.status,
      run.currentActionKey,
      run.failureReason,
      error?.details || {}
    );
    await run.save();
    return run.toObject();
  }
}

export async function processPendingWorkflowEvents({ limit = 25 } = {}) {
  const events = await DomainEvent.find({
    $or: [
      { workflowDispatchedAt: null },
      { workflowDispatchedAt: { $exists: false } },
    ],
  })
    .sort({ occurredAt: 1, _id: 1 })
    .limit(Math.max(1, Math.min(200, Number(limit) || 25)));

  const results = [];
  for (const event of events) {
    results.push({
      eventId: event.eventId,
      runs: await dispatchDomainEventToWorkflows(event._id),
    });
  }
  return results;
}

export async function processDueWorkflowRuns({ limit = 50 } = {}) {
  const ids = await WorkflowRun.find({
    status: "waiting",
    nextRunAt: { $lte: new Date() },
  })
    .sort({ nextRunAt: 1, _id: 1 })
    .limit(Math.max(1, Math.min(200, Number(limit) || 50)))
    .select("_id")
    .lean();

  const results = [];
  for (const item of ids) {
    const result = await executeWorkflowRun(item._id);
    if (result) results.push(result);
  }
  return results;
}

export async function processWorkflowTick(options = {}) {
  const events = await processPendingWorkflowEvents({
    limit: options.eventLimit || 25,
  });
  const dueRuns = await processDueWorkflowRuns({
    limit: options.runLimit || 50,
  });
  return { events, dueRuns };
}

export async function listWorkflowRuns(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.workflow) match.workflow = objectId(query.workflow, "workflow");
  if (query.status) match.status = text(query.status).toLowerCase();
  return WorkflowRun.find(match)
    .populate("workflow", "key name version status")
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 50)))
    .lean();
}

export async function resumeWorkflowRun(runId, { businessId } = {}) {
  objectId(runId, "workflowRun");
  objectId(businessId, "business");
  const run = assertFound(
    await WorkflowRun.findOne({ _id: runId, business: businessId }),
    "Workflow run not found."
  );
  if (!["failed", "blocked", "waiting"].includes(run.status)) {
    throw createServiceError(
      `A ${run.status} workflow run cannot be resumed.`,
      409
    );
  }
  run.status = "pending";
  run.nextRunAt = null;
  run.failureCode = "";
  run.failureReason = "";
  run.lockedAt = null;
  run.lockedBy = "";
  history(run, "pending", run.currentActionKey, "Workflow run resumed.");
  await run.save();
  return executeWorkflowRun(run._id);
}

export default {
  createWorkflowDefinition,
  dispatchDomainEventToWorkflows,
  executeWorkflowRun,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  listWorkflowRuns,
  processDueWorkflowRuns,
  processPendingWorkflowEvents,
  processWorkflowTick,
  resumeWorkflowRun,
  setWorkflowStatus,
};
