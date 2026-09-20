import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildInactiveRetentionPreviewPipeline,
  evaluateRetentionContactReadiness,
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

test("retention contact readiness enforces email and SMS consent", () => {
  const readiness =
    evaluateRetentionContactReadiness(
      {
        email:
          "customer@example.com",
        phone:
          "+447700900123",
        communicationPreferences: {
          promotionalMessages:
            true,
          unsubscribed:
            false,
          emailUnsubscribed:
            false,
          smsUnsubscribed:
            false,
        },
        marketing: {
          emailConsent:
            true,
          emailSuppressed:
            false,
          smsConsent:
            true,
        },
      },
      {
        requiredChannels: [
          "email",
          "sms",
        ],
      }
    );

  assert.equal(
    readiness.fullyReady,
    true
  );
  assert.deepEqual(
    readiness.readyChannels,
    [
      "email",
      "sms",
    ]
  );
  assert.deepEqual(
    readiness.blockedChannels,
    []
  );
});

test("retention contact readiness fails closed for suppression and missing consent", () => {
  const readiness =
    evaluateRetentionContactReadiness(
      {
        email:
          "customer@example.com",
        phone:
          "+447700900123",
        communicationPreferences: {
          promotionalMessages:
            true,
        },
        marketing: {
          emailConsent:
            true,
          emailSuppressed:
            true,
          smsConsent:
            false,
        },
      },
      {
        requiredChannels: [
          "email",
          "sms",
        ],
      }
    );

  assert.equal(
    readiness.fullyReady,
    false
  );
  assert.deepEqual(
    readiness.blockedChannels,
    [
      "email",
      "sms",
    ]
  );

  const email =
    readiness.channels.find(
      (item) =>
        item.channel ===
        "email"
    );
  const sms =
    readiness.channels.find(
      (item) =>
        item.channel ===
        "sms"
    );

  assert.ok(
    email.reasons.includes(
      "provider_email_suppressed"
    )
  );
  assert.ok(
    sms.reasons.includes(
      "sms_consent_missing"
    )
  );
});

test("retention contact readiness requires explicit WhatsApp consent evidence", () => {
  const userAccount =
    "507f1f77bcf86cd799439011";
  const customer = {
    phone:
      "+447700900123",
    userAccount,
    communicationPreferences: {
      promotionalMessages:
        true,
    },
    marketing: {},
  };

  const blocked =
    evaluateRetentionContactReadiness(
      customer,
      {
        requiredChannels: [
          "whatsapp",
        ],
      }
    );

  assert.equal(
    blocked.fullyReady,
    false
  );
  assert.ok(
    blocked.channels[0].reasons.includes(
      "whatsapp_consent_missing"
    )
  );

  const allowed =
    evaluateRetentionContactReadiness(
      customer,
      {
        requiredChannels: [
          "whatsapp",
        ],
        consentEvidence:
          new Map([
            [
              `${userAccount}:whatsapp_marketing`,
              {
                granted:
                  true,
              },
            ],
          ]),
      }
    );

  assert.equal(
    allowed.fullyReady,
    true
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


test("inactive retention preview is a bounded read-only customer pipeline", () => {
  const now =
    new Date(
      "2026-09-20T12:00:00.000Z"
    );

  const built =
    buildInactiveRetentionPreviewPipeline({
      conditions: {
        inactiveDays: 90,
        minimumVisits: 2,
        minimumLifetimeValue: 150,
        retentionRiskLevels: [
          "high",
        ],
      },
      now,
      limit: 500,
      aiPredictionCollection:
        "aipredictions",
    });

  assert.equal(
    built.limit,
    100
  );

  assert.equal(
    built.conditions
      .inactiveDays,
    90
  );

  const serialised =
    JSON.stringify(
      built.pipeline
    );

  assert.match(
    serialised,
    /customer_inactive|lastVisit|previewVisitCount/
  );

  assert.match(
    serialised,
    /aipredictions/
  );

  assert.match(
    serialised,
    /churn_risk/
  );

  assert.match(
    serialised,
    /high/
  );

  assert.equal(
    /\$(out|merge)/.test(
      serialised
    ),
    false
  );
});

test("retention preview route and UI preserve zero-delivery dry-run semantics", async () => {
  const service =
    await readFile(
      new URL(
        "../features/premium/automation/retentionAutomationService.js",
        import.meta.url
      ),
      "utf8"
    );

  const routes =
    await readFile(
      new URL(
        "../features/premium/automation/automationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/RetentionAutomationPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /communicationQueued:\s*false/
  );

  assert.match(
    service,
    /executionAuthorised:\s*false/
  );

  assert.match(
    routes,
    /\/journeys\/:journeyId\/preview/
  );

  assert.match(
    routes,
    /\/journeys\/:journeyId\/preview[\s\S]*customer:read/
  );

  assert.match(
    page,
    /Audience dry-run/
  );

  assert.match(
    page,
    /Messages queued/
  );

  assert.match(
    page,
    /Preview audience/
  );
});
