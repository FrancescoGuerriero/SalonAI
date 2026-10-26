import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Point 9 technical service records are business and location owned", async () => {
  const model = await source("../features/premium/automation/ClientTechnicalServiceRecord.js");

  assert.match(model, /business:[\s\S]*required:\s*true/);
  assert.match(model, /location:[\s\S]*required:\s*true/);
  assert.match(model, /customer:[\s\S]*required:\s*true/);
  assert.match(model, /recordType:[\s\S]*colour[\s\S]*chemical[\s\S]*treatment[\s\S]*cut/);
  assert.match(model, /formulaComponentSchema/);
  assert.match(model, /patchTestSchema/);
  assert.match(model, /photoSchema/);
  assert.match(model, /business:\s*1,[\s\S]*location:\s*1,[\s\S]*customer:\s*1/);
});

test("Point 9 mutations fail closed on location authority and appointment ownership", async () => {
  const service = await source("../features/premium/automation/stage9CrmService.js");

  assert.match(service, /locationAccessMode === "all"/);
  assert.match(service, /allowedLocationIds/);
  assert.match(service, /POINT9_LOCATION_AUTHORITY_REQUIRED/);
  assert.match(service, /POINT9_MUTATION_LOCATION_REQUIRED/);
  assert.match(service, /POINT9_LOCATION_FORBIDDEN/);
  assert.match(service, /Location\.findOne\(\{ _id: locationId, business: scope\.businessId \}\)/);
  assert.match(service, /Appointment\.findOne\(\{[\s\S]*business: scope\.businessId,[\s\S]*location: location\._id,[\s\S]*customer: customer\._id/);
  assert.match(service, /POINT9_APPOINTMENT_OWNERSHIP_MISMATCH/);
});

test("Point 9 retention queue is deterministic and does not authorise messaging", async () => {
  const service = await source("../features/premium/automation/stage9CrmService.js");

  assert.match(service, /observed_visit_median/);
  assert.match(service, /phase11_default_56_days/);
  assert.match(service, /Math\.max\(90, due \+ 30\)/);
  assert.match(service, /"dormant"/);
  assert.match(service, /"overdue"/);
  assert.match(service, /"due"/);
  assert.match(service, /deterministic:\s*true/);
  assert.match(service, /executionAuthorised:\s*false/);
  assert.doesNotMatch(service, /sendEmail|sendSms|sendWhatsApp|publish|charge|paymentIntent/);
});

test("Point 9 Customer 360 v3 layers technical and retention evidence over Stage 7", async () => {
  const service = await source("../features/premium/automation/stage9Customer360Service.js");

  assert.match(service, /buildCustomer360/);
  assert.match(service, /listClientTechnicalRecords/);
  assert.match(service, /listRetentionQueue/);
  assert.match(service, /version:\s*"3"/);
  assert.match(service, /locationAware:\s*true/);
  assert.match(service, /hairProfile/);
  assert.match(service, /technicalHistory/);
  assert.match(service, /opportunities/);
  assert.match(service, /latestLocationId/);
  assert.match(service, /executionAuthorised:\s*false/);
});

test("Point 9 opportunity previews support rebooking reactivation birthday referral and loyalty without execution", async () => {
  const service = await source("../features/premium/automation/stage9Customer360Service.js");

  assert.match(service, /type:\s*state === "dormant" \? "reactivation" : "rebooking"/);
  assert.match(service, /type:\s*"birthday"/);
  assert.match(service, /type:\s*"referral"/);
  assert.match(service, /type:\s*"loyalty"/);
  assert.match(service, /review_birthday_draft/);
  assert.match(service, /review_referral_prompt/);
  assert.match(service, /review_loyalty_value/);
  assert.doesNotMatch(service, /sendEmail|sendSms|sendWhatsApp|enqueue|publish|charge|paymentIntent/);
});

test("Point 9 CRM action drafts are location owned and permanently non-executable", async () => {
  const model = await source("../features/premium/automation/CrmActionDraft.js");
  const service = await source("../features/premium/automation/stage9CrmActionService.js");

  assert.match(model, /location:[\s\S]*required:\s*true/);
  assert.match(model, /opportunityType:[\s\S]*rebooking[\s\S]*reactivation[\s\S]*birthday[\s\S]*referral[\s\S]*loyalty/);
  assert.match(model, /executionAuthorised:[\s\S]*default:\s*false[\s\S]*immutable:\s*true/);
  assert.match(model, /this\.executionAuthorised = false/);
  assert.match(service, /POINT9_OPPORTUNITY_NOT_CURRENT/);
  assert.match(service, /POINT9_ACTION_LOCATION_EVIDENCE_MISMATCH/);
  assert.match(service, /status:\s*"draft"/);
  assert.match(service, /"reviewed"/);
  assert.match(service, /"discarded"/);
  assert.doesNotMatch(service, /sendEmail|sendSms|sendWhatsApp|enqueue|publish|charge|paymentIntent|providerSend/);
});

test("Point 9 routes require effective authority and customer permissions", async () => {
  const routes = await source("../features/premium/automation/automationRoutes.js");

  assert.match(routes, /\/crm\/retention-queue[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:read/);
  assert.match(routes, /\/crm\/opportunities[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:read/);
  assert.match(routes, /\/crm\/customers\/:customerId\/360[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:read/);
  assert.match(routes, /\/crm\/action-drafts[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:read[\s\S]*customer:update/);
  assert.match(routes, /\/crm\/action-drafts\/:draftId[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:update/);
  assert.match(routes, /\/crm\/customers\/:customerId\/technical-records/);
  assert.match(routes, /effectiveAuthorityMiddleware,[\s\S]*customer:read[\s\S]*getTechnicalRecords/);
  assert.match(routes, /effectiveAuthorityMiddleware,[\s\S]*customer:update[\s\S]*createTechnicalRecord/);
});

test("Point 9 frontend exposes authoring without send execution", async () => {
  const service = await source("../../../frontend/src/Services/retentionAutomationService.js");
  const panel = await source("../../../frontend/src/components/retention/Stage9CrmRetentionPanel.jsx");
  const customer360 = await source("../../../frontend/src/components/retention/Stage9Customer360Panel.jsx");
  const page = await source("../../../frontend/src/pages/RetentionAutomationPage.jsx");

  assert.match(service, /listRetentionQueue/);
  assert.match(service, /listClientTechnicalRecords/);
  assert.match(service, /createClientTechnicalRecord/);
  assert.match(service, /getPoint9Customer360/);
  assert.match(service, /listRetentionOpportunities/);
  assert.match(service, /createCrmActionDraft/);
  assert.match(service, /listCrmActionDrafts/);
  assert.match(service, /updateCrmActionDraft/);
  assert.match(panel, /Rebooking and dormant-client queue/);
  assert.match(panel, /Salon technical history/);
  assert.match(panel, /Save location-owned technical record/);
  assert.match(panel, /56-day rebooking interval/);
  assert.match(customer360, /Customer 360 v3/);
  assert.match(customer360, /Create review draft/);
  assert.match(customer360, /No send action available/);
  assert.match(customer360, /Draft-only/);
  assert.doesNotMatch(customer360, />Send</);
  assert.match(page, /Stage9CrmRetentionPanel/);
  assert.match(page, /Stage9Customer360Panel/);
  assert.match(page, /data-point9-workspace="original-phase-11"/);
});
