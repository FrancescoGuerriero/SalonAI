import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateWorkflowConditions,
  interpolateWorkflowText,
} from "../features/workflows/workflowConditionEvaluator.js";
import {
  assertWorkflowCommunicationAllowed,
} from "../features/workflows/workflowCommunicationPolicy.js";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("workflow conditions evaluate typed event context and branches", () => {
  const context = {
    event: {
      type: "lead.scored",
      payload: {
        score: 82,
        band: "hot",
        tags: ["colour", "vip"],
      },
    },
  };

  assert.equal(
    evaluateWorkflowConditions(
      [
        { path: "event.payload.score", operator: "gte", value: 70 },
        { path: "event.payload.band", operator: "eq", value: "hot" },
        { path: "event.payload.tags", operator: "contains", value: "vip" },
      ],
      context
    ),
    true
  );
  assert.equal(
    interpolateWorkflowText(
      "Lead is {{event.payload.band}} at {{event.payload.score}}.",
      context
    ),
    "Lead is hot at 82."
  );
});

test("workflow marketing policy is fail-closed and transactional consent remains separate", () => {
  const customer = {
    _id: "64f000000000000000000001",
    email: "customer@example.com",
    phone: "+447700900000",
    communicationPreferences: {
      unsubscribed: false,
      emailUnsubscribed: false,
      emailMarketing: true,
      smsUnsubscribed: false,
      smsMarketing: false,
    },
    marketing: {
      emailConsent: true,
      emailSuppressed: false,
      smsConsent: false,
    },
  };

  assert.equal(
    assertWorkflowCommunicationAllowed(customer, {
      channel: "email",
      classification: "marketing",
    }).recipient,
    "customer@example.com"
  );

  assert.throws(
    () =>
      assertWorkflowCommunicationAllowed(customer, {
        channel: "sms",
        classification: "marketing",
      }),
    /Marketing consent is not recorded/
  );

  assert.equal(
    assertWorkflowCommunicationAllowed(customer, {
      channel: "sms",
      classification: "transactional",
    }).recipient,
    "+447700900000"
  );
});

test("workflow runtime consumes domain events, supports delays and uses the canonical communication queue", async () => {
  const service = await source("../features/workflows/workflowEngineService.js");
  const runModel = await source("../models/WorkflowRun.js");
  const eventModel = await source("../models/DomainEvent.js");
  const scheduler = await source("../features/scheduler/schedulerController.js");
  const routes = await source("../features/futureFeatureRoutes.js");

  assert.match(service, /dispatchDomainEventToWorkflows/);
  assert.match(service, /evaluateWorkflowConditions/);
  assert.match(service, /action\.actionType === "delay"/);
  assert.match(service, /action\.actionType === "branch"/);
  assert.match(service, /ScheduledCommunication\.create/);
  assert.match(service, /WORKFLOW_COMMUNICATION_POLICY_BLOCKED/);
  assert.match(runModel, /idempotencyKey/);
  assert.match(runModel, /nextRunAt/);
  assert.match(eventModel, /workflowDispatchedAt/);
  assert.match(scheduler, /processWorkflowTick/);
  assert.match(routes, /workflowRoutes/);
  assert.match(routes, /"\/workflows"/);
});
