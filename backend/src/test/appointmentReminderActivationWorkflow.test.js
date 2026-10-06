import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("appointment reminder activation is release-pinned, non-immediate and rollback capable", async () => {
  const workflow = await readFile(
    new URL(
      "../../../.github/workflows/production-appointment-reminder-activation.yml",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(workflow, /ENABLE_APPOINTMENT_REMINDERS/);
  assert.match(workflow, /MESSAGE_DELIVERY_SCHEDULER_ENABLED true/);
  assert.match(workflow, /APPOINTMENT_REMINDER_JOB_ENABLED true/);
  assert.match(workflow, /APPOINTMENT_REMINDER_JOB_RUN_IMMEDIATELY false/);
  assert.match(workflow, /scheduledCampaignsDue/);
  assert.match(workflow, /retryableDeliveriesDue/);
  assert.match(workflow, /rollback\(\)/);
  assert.match(workflow, /--force-recreate backend/);
  assert.match(workflow, /restart edge/);
  assert.match(workflow, /reminders\.runningCycle !== false/);

  assert.doesNotMatch(workflow, /notifyAppointmentReminder\(/);
  assert.doesNotMatch(workflow, /sendTransactionalNotification\(/);
});
