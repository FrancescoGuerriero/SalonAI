import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("dashboard APIs require dashboard:view", async () => {
  for (const path of [
    "../routes/dashboardRoutes.js",
    "../routes/dashboardInsightsRoutes.js",
  ]) {
    const routes =
      await source(path);

    assert.match(
      routes,
      /requirePermissions\(\s*"dashboard:view"\s*\)/
    );
  }
});

test("campaign and template reads are separated from management actions", async () => {
  const campaign =
    await source(
      "../routes/communicationCampaignRoutes.js"
    );
  const template =
    await source(
      "../routes/communicationTemplateRoutes.js"
    );

  for (const routes of [
    campaign,
    template,
  ]) {
    assert.match(
      routes,
      /requireAnyPermission\(\s*"communications:read",\s*"communications:manage"\s*\)/
    );
    assert.match(
      routes,
      /requirePermissions\(\s*"communications:manage"\s*\)/
    );
  }

  assert.match(
    campaign,
    /router\.get\(\s*"\/",\s*readCommunications,\s*listCampaigns/s
  );
  assert.match(
    campaign,
    /router\.post\(\s*"\/",\s*manageCommunications,\s*createCampaign/s
  );
  assert.match(
    template,
    /router\.get\(\s*"\/",\s*readCommunications,\s*communicationTemplateController\.listCommunicationTemplates/s
  );
  assert.match(
    template,
    /router\.post\(\s*"\/",\s*manageCommunications,\s*communicationTemplateController\.createCommunicationTemplate/s
  );
});

test("scheduled communication and delivery mutation routes require management authority", async () => {
  const scheduled =
    await source(
      "../routes/scheduledCommunicationRoutes.js"
    );
  const delivery =
    await source(
      "../routes/messageDeliveryRoutes.js"
    );

  assert.match(
    scheduled,
    /"\/:campaignId\/schedule",\s*manageCommunications/s
  );
  assert.match(
    scheduled,
    /router\.get\(\s*"\/",\s*readCommunications/s
  );

  assert.match(
    delivery,
    /"\/send",\s*manageCommunications/s
  );
  assert.match(
    delivery,
    /"\/deliveries",\s*readCommunications/s
  );
  assert.match(
    delivery,
    /"\/deliveries\/:identifier\/retry",\s*manageCommunications/s
  );
});

test("Twilio delivery status webhook remains outside staff JWT permission gates", async () => {
  const delivery =
    await source(
      "../routes/messageDeliveryRoutes.js"
    );

  const webhookIndex =
    delivery.indexOf(
      '"/webhooks/twilio/status"'
    );
  const protectIndex =
    delivery.indexOf(
      "router.use(protect)"
    );

  assert.ok(
    webhookIndex >= 0
  );
  assert.ok(
    protectIndex > webhookIndex
  );
});
