import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";


const controllerPath =
  new URL(
    "../features/premium/whatsapp/whatsappWebhookController.js",
    import.meta.url
  );


test(
  "WhatsApp webhook queues bot work only after secure inbound persistence",
  async () => {
    const source =
      await readFile(
        controllerPath,
        "utf8"
      );

    const signature =
      source.indexOf(
        "verifyWhatsAppWebhookRequest"
      );

    const save =
      source.indexOf(
        "await saveIncomingMessage"
      );

    const queue =
      source.indexOf(
        "void queueWhatsAppBotMessage"
      );

    assert.ok(
      signature >= 0,
      "signature verification must remain present"
    );

    assert.ok(
      save > signature,
      "inbound persistence must follow signature verification"
    );

    assert.ok(
      queue > save,
      "bot queueing must happen after inbound persistence"
    );

    assert.match(
      source,
      /if\s*\(\s*result\.duplicate\s*\)/
    );

    assert.match(
      source,
      /void queueWhatsAppBotMessage\(\{/
    );
  }
);
