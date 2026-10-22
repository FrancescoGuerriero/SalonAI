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
        '"whatsapp:manage"'
      );

    const resumeRoute =
      routes.indexOf(
        '"/conversations/:conversationId/resume-bot"'
      );

    assert.ok(protect >= 0);
    assert.ok(
      management > protect
    );
    assert.ok(
      resumeRoute > management
    );
    assert.match(
      routes,
      /requirePermissions/
    );

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
      /ConsultationSession\.findOne\(\{[\s\S]*business:\s*conversation\.business[\s\S]*location:\s*conversation\.location[\s\S]*customer:\s*conversation\.customer[\s\S]*sourceConversation:\s*conversation\._id[\s\S]*channel:\s*"whatsapp"/
    );

    assert.match(
      controller,
      /buildResumeWhatsAppBotMutation\([\s\S]*current[\s\S]*consultationSession/
    );

    assert.match(
      controller,
      /findOneAndUpdate\(/
    );

    assert.match(
      controller,
      /returnDocument:\s*"after"/
    );

    assert.match(
      controller,
      /resumeMode:\s*mutation\.resumeMode/
    );
  }
);
