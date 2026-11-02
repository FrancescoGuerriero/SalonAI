import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("destinations and AI destinations are not exposed as ordinary Marketing import sources", async () => {
  const [page, catalogue] = await Promise.all([
    source("../../../frontend/src/pages/MarketingDataConnectionsPage.jsx"),
    source("../features/integrationPlatform/dataConnectionCatalogue.js"),
  ]);

  assert.match(catalogue, /"destination"/);
  assert.match(catalogue, /"ai-destination"/);
  assert.match(catalogue, /item\("chatgpt"[\s\S]*"ai-destination"/);
  assert.match(catalogue, /item\("claude"[\s\S]*"ai-destination"/);
  assert.match(catalogue, /item\("copilot_agent"[\s\S]*"ai-destination"/);
  assert.match(catalogue, /item\("power_bi"[\s\S]*"destination"/);

  assert.match(page, /const isDestination = \["destination", "ai-destination"\]\.includes\(item\.kind\)/);
  assert.match(page, /This is a downstream data\/AI destination, not a Marketing source/);
  assert.match(page, /Destination activation is kept separate from source ingestion/);
});

test("Marketing presents native and managed provider modes without creating another commercial module", async () => {
  const [landing, page, routes] = await Promise.all([
    source("../../../frontend/src/pages/MarketingModulePage.jsx"),
    source("../../../frontend/src/pages/MarketingDataConnectionsPage.jsx"),
    source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js"),
  ]);

  assert.match(landing, /title: "Data connections"/);
  assert.match(landing, /managed source connections/);
  assert.match(landing, /title: "Native connections"/);
  assert.match(landing, /shared AIIBP connection framework without creating another commercial module/);
  assert.match(page, /AIIBP data connections/);
  assert.match(routes, /shared catalogue can be[\s\S]*reuse one provider-neutral[\s\S]*without creating duplicate commercial workspaces/);
});

test("Marketing consumes canonical CRM customer and consent state instead of creating a second consent authority", async () => {
  const crm = await source("../features/premium/automation/stage7CrmService.js");

  assert.match(crm, /import ConsentRecord/);
  assert.match(crm, /import Customer from/);
  assert.match(crm, /ConsentRecord\.find\(\{/);
  assert.match(crm, /email_marketing/);
  assert.match(crm, /sms_marketing/);
  assert.match(crm, /whatsapp_marketing/);
  assert.match(crm, /preferences\.unsubscribed !== true/);
  assert.match(crm, /marketing\.emailSuppressed !== true/);
  assert.match(crm, /executionAuthorised:\s*false/);
  assert.doesNotMatch(crm, /new ConsentRecord|ConsentRecord\.create|ConsentRecord\.findOneAndUpdate/);
});

test("Marketing journeys consume CRM evidence but do not become a parallel message-delivery authority", async () => {
  const [journey, campaignRoutes, templateRoutes, scheduledRoutes, deliveryRoutes] = await Promise.all([
    source("../features/premium/automation/stage7JourneyService.js"),
    source("../routes/communicationCampaignRoutes.js"),
    source("../routes/communicationTemplateRoutes.js"),
    source("../routes/scheduledCommunicationRoutes.js"),
    source("../routes/messageDeliveryRoutes.js"),
  ]);

  assert.match(journey, /buildCustomer360/);
  assert.match(journey, /executionAuthorised:\s*false/);
  assert.match(journey, /reason:\s*"execution_not_authorised"/);
  assert.doesNotMatch(journey, /sendgrid|twilio|sendSms|sendEmail|sendWhatsApp|ScheduledCommunication\.create/i);

  for (const routes of [campaignRoutes, templateRoutes, scheduledRoutes, deliveryRoutes]) {
    assert.match(routes, /requireCommercialModule\("communications"\)/);
  }
  assert.match(campaignRoutes, /communications:manage/);
  assert.match(templateRoutes, /communications:manage/);
  assert.match(scheduledRoutes, /communications:manage/);
  assert.match(deliveryRoutes, /communications:manage/);
});
