import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

const workflowUrl =
  new URL(
    "../../../.github/workflows/production-communication-scheduler-readiness.yml",
    import.meta.url
  );

test(
  "production communication scheduler readiness is serialized and read-only",
  async () => {
    const workflow =
      await readFile(
        workflowUrl,
        "utf8"
      );

    assert.match(
      workflow,
      /group:\s*salonai-production-deployment/
    );
    assert.match(
      workflow,
      /cancel-in-progress:\s*false/
    );
    assert.match(
      workflow,
      /node scripts\/checkCommunicationSchedulerReadiness\.js/
    );
    assert.match(
      workflow,
      /No provider send, campaign processing, reminder delivery, retry attempt, or database mutation was requested/
    );

    assert.doesNotMatch(
      workflow,
      /runMessageDeliverySchedulerCycle/
    );
    assert.doesNotMatch(
      workflow,
      /runAppointmentReminderCycle/
    );
    assert.doesNotMatch(
      workflow,
      /--apply/
    );
  }
);
