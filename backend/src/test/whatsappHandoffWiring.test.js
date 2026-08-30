import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

const routesPath =
  new URL(
    "../features/premium/whatsapp/whatsappRoutes.js",
    import.meta.url
  );

const controllerPath =
  new URL(
    "../features/premium/whatsapp/whatsappHandoffController.js",
    import.meta.url
  );

test(
  "WhatsApp resume-bot route remains management protected and uses guarded lifecycle mutation",
  async () => {
    const [routes, controller] =
      await Promise.all([
        readFile(routesPath, "utf8"),
        readFile(controllerPath, "utf8"),
      ]);

    const protect =
      routes.indexOf(
        "router.use(protect)"
      );

    const management =
      routes.indexOf(
        "router.use(managementOnly)"
      );

    const resumeRoute =
      routes.indexOf(
        '"/conversations/:conversationId/resume-bot"'
      );

    assert.ok(protect >= 0);
    assert.ok(management > protect);
    assert.ok(resumeRoute > management);

    assert.match(
      routes,
      /resumeWhatsAppBot/
    );

    assert.match(
      controller,
      /buildResumeWhatsAppBotMutation/
    );

    assert.match(
      controller,
      /findOneAndUpdate\(/
    );

    assert.match(
      controller,
      /returnDocument:\s*"after"/
    );
  }
);
