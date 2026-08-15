import assert from "node:assert/strict";
import test from "node:test";

import {
  getDatabaseJobStatus,
  startDatabaseJobs,
  stopDatabaseJobs,
} from "../jobs/jobLifecycle.js";

test("database job lifecycle exposes reminder startup and shutdown controls", () => {
  assert.equal(typeof startDatabaseJobs, "function");
  assert.equal(typeof stopDatabaseJobs, "function");
  assert.equal(typeof getDatabaseJobStatus, "function");
});

test("database job status includes appointment reminder state", () => {
  const status = getDatabaseJobStatus();

  assert.ok(status.appointmentReminders);
  assert.equal(
    typeof status.appointmentReminders.started,
    "boolean"
  );
  assert.equal(
    status.appointmentReminders.configuration.channel,
    "customer_preference"
  );
});
