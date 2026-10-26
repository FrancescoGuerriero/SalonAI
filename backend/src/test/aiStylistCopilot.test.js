import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Stylist Copilot route uses trusted tenant and effective authority chain", () => {
  const routes = read("features/aiRecommendations/aiRecommendationRoutes.js");
  assert.match(
    routes,
    /"\/stylist-copilot\/appointments\/:appointmentId"[\s\S]*?\.\.\.tenantAwareAiChain[\s\S]*?getAiStylistCopilot/
  );
  assert.match(
    routes,
    /const tenantAwareAiChain = \[[\s\S]*?trustedTenantContextMiddleware[\s\S]*?effectiveAuthorityMiddleware[\s\S]*?requirePermissions\([\s\S]*?"ai:use"/
  );
});

test("Stylist Copilot context is canonical, scoped and advisory-only", () => {
  const service = read("features/aiRecommendations/aiStylistCopilotService.js");
  assert.match(service, /Appointment\.findOne/);
  assert.match(service, /Customer\.findOne/);
  assert.match(service, /ConsultationSession\.findOne/);
  assert.match(service, /Order\.find/);
  assert.match(service, /CustomerNote\.find/);
  assert.match(service, /"items\.itemType": "product"/);
  assert.match(service, /visibility: "staff"/);
  assert.match(service, /status: "completed"/);
  assert.match(service, /dataProcessingConsent/);
  assert.match(service, /canonicalWritesAllowed: false/);
  assert.match(service, /autonomousCustomerMessagingAllowed: false/);
  assert.match(service, /medicalDiagnosisAllowed: false/);
  assert.match(service, /safetyRuleOverrideAllowed: false/);
});

test("Stylist Copilot excludes consultation AI context without explicit processing consent", () => {
  const service = read("features/aiRecommendations/aiStylistCopilotService.js");
  assert.match(
    service,
    /consultationCandidate\?\.governance\?\.dataProcessingConsent === true[\s\S]*?\? consultationCandidate[\s\S]*?: null/
  );
  assert.match(service, /const consentedSensitiveContext = Boolean\(consultation\)/);
});

test("Stylist Copilot Node to Python mapping matches the versioned contract", () => {
  const client = read("features/aiRecommendations/stylistCopilotAiClient.js");
  assert.match(client, /definitionVersion: "1"/);
  assert.match(client, /actorContext:/);
  assert.match(client, /previousServices:/);
  assert.match(client, /previousProducts:/);
  assert.match(client, /followUp:/);
  assert.match(client, /consentedContextKeys:/);
  assert.match(client, /constraints: context\.constraints/);
});

test("Stylist Copilot writes governed inference provenance", () => {
  const service = read("features/aiRecommendations/aiStylistCopilotService.js");
  assert.match(service, /AiInferenceLog\.create/);
  assert.match(service, /capability: "stylist-copilot"/);
  assert.match(service, /entityType: "appointment"/);
  assert.match(service, /advisoryOnly: true/);
  assert.match(service, /humanReviewRequired: true/);
  assert.match(service, /orders:customer-product-history/);
  assert.match(service, /customer-notes:staff-follow-up/);
});

test("Node calls only the authenticated governed Python Stylist Copilot endpoint", () => {
  const client = read("features/aiRecommendations/stylistCopilotAiClient.js");
  assert.match(client, /"\/api\/v1\/stylist-copilot\/brief"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /body: toPythonPayload\(payload\)/);
  assert.match(client, /authenticated: true/);
});
