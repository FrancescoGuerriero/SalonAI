import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normaliseRetentionConditions,
  normaliseRetentionJourneyPayload,
  normaliseRetentionSteps,
} from "../features/premium/automation/retentionAutomationService.js";

test("retention journey conditions are bounded and risk levels are normalised", () => {
  assert.deepEqual(
    normaliseRetentionConditions({
      inactiveDays: 9999,
      minimumVisits: -2,
      minimumLifetimeValue: "125.50",
      retentionRiskLevels: [
        "HIGH",
        "low",
        "high",
        "unknown",
      ],
    }),
    {
      inactiveDays: 730,
      minimumVisits: 0,
      minimumLifetimeValue: 125.5,
      retentionRiskLevels: [
        "high",
        "low",
      ],
    }
  );
});

test("retention journey steps are re-ordered and validated", () => {
  assert.deepEqual(
    normaliseRetentionSteps([
      {
        order: 99,
        delayMinutes: -10,
        channel: "email",
        subject: "  Come back soon  ",
        body: "  Hello customer  ",
        stopIf: "appointment_booked",
      },
      {
        order: 1,
        delayMinutes: 90,
        channel: "whatsapp",
        body: "Follow-up message",
        stopIf: "none",
      },
    ]),
    [
      {
        order: 1,
        delayMinutes: 0,
        channel: "email",
        subject: "Come back soon",
        body: "Hello customer",
        stopIf: "appointment_booked",
      },
      {
        order: 2,
        delayMinutes: 90,
        channel: "whatsapp",
        subject: "",
        body: "Follow-up message",
        stopIf: "none",
      },
    ]
  );

  assert.throws(
    () =>
      normaliseRetentionSteps([
        {
          channel: "carrier-pigeon",
          body: "Hello",
        },
      ]),
    /Step channel must be one of/
  );
});

test("new retention journey payloads require a valid trigger and at least one step", () => {
  assert.throws(
    () =>
      normaliseRetentionJourneyPayload({
        name: "Dormant return",
        trigger: "unknown",
        steps: [
          {
            channel: "email",
            body: "Hello",
          },
        ],
      }),
    /Journey trigger must be one of/
  );

  const payload =
    normaliseRetentionJourneyPayload({
      name: "  Dormant return  ",
      description:
        "  Re-engage inactive customers  ",
      trigger:
        "customer_inactive",
      conditions: {
        inactiveDays: 75,
      },
      steps: [
        {
          channel: "sms",
          body:
            "We would love to see you again.",
          stopIf:
            "appointment_booked",
        },
      ],
    });

  assert.equal(
    payload.name,
    "Dormant return"
  );
  assert.equal(
    payload.conditions.inactiveDays,
    75
  );
  assert.equal(
    payload.steps.length,
    1
  );
});

test("retention automation UI uses the dedicated management service", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/RetentionAutomationPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const service =
    await readFile(
      new URL(
        "../../../frontend/src/Services/retentionAutomationService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /Journey builder/
  );
  assert.match(
    page,
    /Execution engine pending/
  );
  assert.match(
    page,
    /updateRetentionJourney/
  );
  assert.match(
    service,
    /retention-automation\/journeys/
  );
});
