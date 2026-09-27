import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommunicationSchedulerReadinessReport,
} from "../services/communicationSchedulerReadinessService.js";

function scheduler(overrides = {}) {
  return {
    enabled: true,
    intervalMs: 60000,
    campaignLimit: 25,
    campaignConcurrency: 3,
    retryLimit: 50,
    retryConcurrency: 5,
    runImmediately: false,
    ...overrides,
  };
}

function reminder(overrides = {}) {
  return {
    enabled: true,
    intervalMs: 300000,
    hoursBefore: 24,
    lookAheadHours: 48,
    runImmediately: false,
    ...overrides,
  };
}

test("scheduler readiness passes with readable database and enabled canonical runtime jobs", () => {
  const report =
    buildCommunicationSchedulerReadinessReport({
      databaseReadable: true,
      schedulerConfiguration:
        scheduler(),
      reminderConfiguration:
        reminder(),
      inventory: {
        scheduledCampaignsDue: 2,
        scheduledCampaignsFuture: 4,
        retryableDeliveriesDue: 1,
        retryableDeliveriesFuture: 3,
        processingDeliveries: 0,
        failedOrUndelivered: 5,
        pendingDeliveries: 6,
      },
    });

  assert.equal(
    report.readyForActivation,
    true
  );
  assert.deepEqual(
    report.blockers,
    []
  );
  assert.equal(
    report.inventory
      .retryableDeliveriesDue,
    1
  );
  assert.equal(
    report.providerSends,
    false
  );
  assert.equal(
    report.databaseWrites,
    false
  );
});

test("scheduler readiness fails closed when database is unreadable", () => {
  const report =
    buildCommunicationSchedulerReadinessReport({
      databaseReadable: false,
      schedulerConfiguration:
        scheduler(),
      reminderConfiguration:
        reminder(),
    });

  assert.equal(
    report.readyForActivation,
    false
  );
  assert.equal(
    report.blockers.includes(
      "databaseReadable"
    ),
    true
  );
});

test("scheduler readiness reports disabled scheduler and reminder independently", () => {
  const report =
    buildCommunicationSchedulerReadinessReport({
      databaseReadable: true,
      schedulerConfiguration:
        scheduler({
          enabled: false,
        }),
      reminderConfiguration:
        reminder({
          enabled: false,
        }),
    });

  assert.equal(
    report.readyForActivation,
    false
  );
  assert.equal(
    report.blockers.includes(
      "messageDeliverySchedulerEnabled"
    ),
    true
  );
  assert.equal(
    report.blockers.includes(
      "appointmentReminderJobEnabled"
    ),
    true
  );
});

test("appointment reminder window must cover the reminder lead time", () => {
  const report =
    buildCommunicationSchedulerReadinessReport({
      databaseReadable: true,
      schedulerConfiguration:
        scheduler(),
      reminderConfiguration:
        reminder({
          hoursBefore: 24,
          lookAheadHours: 12,
        }),
    });

  assert.equal(
    report.readyForActivation,
    false
  );
  assert.equal(
    report.appointmentReminders
      .windowValid,
    false
  );
  assert.equal(
    report.blockers.includes(
      "appointmentReminderWindow"
    ),
    true
  );
});

test("scheduler readiness exposes counts only and no recipient identities", () => {
  const report =
    buildCommunicationSchedulerReadinessReport({
      databaseReadable: true,
      schedulerConfiguration:
        scheduler(),
      reminderConfiguration:
        reminder(),
      inventory: {
        scheduledCampaignsDue: "2",
        retryableDeliveriesDue: "1",
        accidentalRecipient:
          "private@example.com",
      },
    });

  const serialised =
    JSON.stringify(report);

  assert.equal(
    serialised.includes(
      "private@example.com"
    ),
    false
  );
  assert.equal(
    report.piiIncluded,
    false
  );
});
