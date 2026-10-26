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

test("Point 9 routes require effective authority and customer permissions", async () => {
  const routes = await source("../features/premium/automation/automationRoutes.js");

  assert.match(routes, /\/crm\/retention-queue[\s\S]*effectiveAuthorityMiddleware[\s\S]*customer:read/);
  assert.match(routes, /\/crm\/customers\/:customerId\/technical-records/);
  assert.match(routes, /effectiveAuthorityMiddleware,[\s\S]*customer:read[\s\S]*getTechnicalRecords/);
  assert.match(routes, /effectiveAuthorityMiddleware,[\s\S]*customer:update[\s\S]*createTechnicalRecord/);
});

test("Point 9 frontend exposes retention queue and salon technical history", async () => {
  const service = await source("../../../frontend/src/Services/retentionAutomationService.js");
  const panel = await source("../../../frontend/src/components/retention/Stage9CrmRetentionPanel.jsx");
  const page = await source("../../../frontend/src/pages/RetentionAutomationPage.jsx");

  assert.match(service, /listRetentionQueue/);
  assert.match(service, /listClientTechnicalRecords/);
  assert.match(service, /createClientTechnicalRecord/);
  assert.match(panel, /Rebooking and dormant-client queue/);
  assert.match(panel, /Salon technical history/);
  assert.match(panel, /56-day rebooking interval/);
  assert.match(panel, /does not authorise outbound retention messaging/);
  assert.match(page, /Stage9CrmRetentionPanel/);
  assert.match(page, /data-point9-workspace="original-phase-11"/);
});
