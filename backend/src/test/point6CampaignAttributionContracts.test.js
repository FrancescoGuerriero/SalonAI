import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Point 6 master campaigns are tenant-owned and cross-channel", async () => {
  const model = await source("../features/campaigns/Campaign.js");
  const execution = await source("../features/campaigns/CampaignExecution.js");

  assert.match(model, /business:[\s\S]*?ref:\s*"Business"/);
  assert.match(model, /campaignKey/);
  assert.match(model, /channels/);
  assert.match(model, /facebook/);
  assert.match(model, /instagram/);
  assert.match(model, /linkedin/);
  assert.match(model, /google_business_profile/);
  assert.match(model, /utm:[\s\S]*?source:[\s\S]*?medium:[\s\S]*?campaign:/);
  assert.match(model, /business:\s*1,[\s\S]*?campaignKey:\s*1/);

  assert.match(execution, /business:[\s\S]*?required:\s*true/);
  assert.match(execution, /campaign:[\s\S]*?required:\s*true/);
  assert.match(execution, /idempotencyKey:[\s\S]*?required:\s*true/);
  assert.match(execution, /metrics:[\s\S]*?conversions:[\s\S]*?revenue:/);
});

test("Point 6 attribution is append-only, deduplicated and tenant-safe", async () => {
  const model = await source("../features/campaigns/AttributionTouch.js");
  const service = await source("../features/campaigns/growthCampaignService.js");

  assert.match(model, /ATTRIBUTION_TOUCH_IMMUTABLE/);
  assert.match(model, /business:\s*1,[\s\S]*?sourceKey:\s*1/);
  assert.match(model, /touchType:[\s\S]*?first_touch[\s\S]*?conversion/);

  assert.match(service, /Campaign\.findOne\(\{[\s\S]*?business:\s*businessId/);
  assert.match(service, /Lead\.findOne\(\{ _id: lead, business: businessId \}/);
  assert.match(service, /Customer\.findOne\([\s\S]*?business:\s*businessId/);
  assert.match(service, /Opportunity\.findOne\(\{ _id: opportunity, business: businessId \}/);
  assert.match(service, /const existing = await AttributionTouch\.findOne/);
  assert.match(service, /AttributionTouch\.create\(document\)/);
  assert.doesNotMatch(
    service,
    /AttributionTouch\.findOneAndUpdate/
  );
  assert.match(service, /firstTouch/);
  assert.match(service, /lastTouch/);
  assert.match(service, /conversionTouch/);
});

test("campaign and segment audiences never query customers globally", async () => {
  const campaigns = await source("../features/campaigns/campaignService.js");
  const segments = await source("../features/segments/segmentService.js");
  const segmentModel = await source("../features/segments/CustomerSegment.js");

  assert.match(campaigns, /Campaign\.findOne\(\{ _id: id, business: tenantBusinessId \}\)/);
  assert.match(campaigns, /business:\s*tenantBusinessId,[\s\S]*?status:\s*\{ \$ne: "deleted" \}/);
  assert.match(campaigns, /CAMPAIGN_RECIPIENT_TENANCY_MISMATCH/);
  assert.match(campaigns, /CAMPAIGN_CHANNEL_REQUIRES_PROVIDER_EXECUTION/);

  assert.match(segmentModel, /business:[\s\S]*?ref:\s*"Business"/);
  assert.match(segments, /CustomerSegment\.findOne\(\{[\s\S]*?business:\s*tenantBusinessId/);
  assert.match(segments, /Customer\.find\(\{[\s\S]*?business:\s*tenantBusinessId/);
  assert.match(segments, /SEGMENT_CUSTOMER_TENANCY_MISMATCH/);
});

test("canonical lead lifecycle records and exposes attribution", async () => {
  const controller = await source("../features/leads/leadController.js");
  const routes = await source("../features/leads/leadRoutes.js");

  assert.match(controller, /recordLeadCaptureAttribution/);
  assert.match(controller, /recordLeadConversionAttribution/);
  assert.match(controller, /touchType:\s*"opportunity"/);
  assert.match(controller, /status:\s*"unresolved"/);
  assert.match(controller, /attributionForLead/);

  assert.match(routes, /\/:leadId\/attribution/);
  assert.match(routes, /requirePermissions\("customer:read"\)/);
  assert.match(routes, /requirePermissions\("customer:update"\)/);
});

test("campaign API exposes governed provider executions", async () => {
  const controller = await source("../features/campaigns/campaignController.js");
  const routes = await source("../features/campaigns/campaignRoutes.js");

  assert.match(controller, /createCampaignExecution/);
  assert.match(controller, /listCampaignExecutions/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
  assert.match(routes, /\/:id\/executions/);
  assert.match(routes, /requirePermissions\("communications:manage"\)/);
});
