import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

const workflowUrl =
  new URL(
    "../../../.github/workflows/production-sendgrid-readiness.yml",
    import.meta.url
  );

test(
  "production SendGrid readiness audit is read-only and serialized with deployments",
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
      /node scripts\/checkSendGridReadiness\.js/
    );
    assert.match(
      workflow,
      /No email was sent/
    );
    assert.doesNotMatch(
      workflow,
      /docker exec salonai-backend npm/
    );
    assert.match(
      workflow,
      /SendGrid readiness script did not produce a readiness report/
    );
    assert.doesNotMatch(
      workflow,
      /sendgrid:acceptance/
    );
    assert.doesNotMatch(
      workflow,
      /RUN_SENDGRID_EMAIL_ACCEPTANCE/
    );
  }
);
