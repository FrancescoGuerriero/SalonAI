import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

const workflowUrl =
  new URL(
    "../../../.github/workflows/production-twilio-whatsapp-readiness.yml",
    import.meta.url
  );

test(
  "production Twilio WhatsApp readiness audit is read-only and serialized with deployments",
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
      /node scripts\/checkTwilioWhatsAppReadiness\.js/
    );
    assert.match(
      workflow,
      /No WhatsApp or SMS message was sent/
    );
    assert.match(
      workflow,
      /No provider send or database mutation was requested/
    );
    assert.doesNotMatch(
      workflow,
      /testTwilioMessagingAcceptance/
    );
    assert.doesNotMatch(
      workflow,
      /RUN_TWILIO_MESSAGING_ACCEPTANCE/
    );
  }
);
