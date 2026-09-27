import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test("backend runtime wires only the canonical appointment reminder job and keeps it environment-gated", async () => {
  const server =
    await readFile(
      new URL(
        "../../server.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    server,
    /from "\.\/src\/jobs\/appointmentReminderJob\.js"/
  );
  assert.match(
    server,
    /startAppointmentReminderJob\(\)/
  );
  assert.match(
    server,
    /stopAppointmentReminderJob\(\{\s*waitForCycle:\s*true/
  );
  assert.match(
    server,
    /getAppointmentReminderJobStatus\(\)/
  );
  assert.match(
    server,
    /APPOINTMENT_REMINDER_JOB_ENABLED/
  );

  assert.doesNotMatch(
    server,
    /src\/features\/appointmentReminderJob\.js/
  );
});

test("appointment reminder activation remains disabled by default in the documented environment", async () => {
  const environment =
    await readFile(
      new URL(
        "../../.env.example",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    environment,
    /^APPOINTMENT_REMINDER_JOB_ENABLED=false$/m
  );
  assert.match(
    environment,
    /^MESSAGE_DELIVERY_SCHEDULER_ENABLED=false$/m
  );
});
