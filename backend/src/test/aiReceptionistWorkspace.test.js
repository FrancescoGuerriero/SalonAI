import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AI Receptionist workspace consumes tenant-scoped workforce evidence through read-only APIs", async () => {
  const [page, service] = await Promise.all([
    source("../../../frontend/src/pages/AiReceptionistPage.jsx"),
    source("../../../frontend/src/Services/aiWorkforceService.js"),
  ]);

  for (const endpoint of [
    "/ai/workforce/registry",
    "/ai/workforce/runs",
    "/ai/workforce/proposals",
    "/ai/workforce/outcomes",
  ]) {
    assert.match(service, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  assert.match(service, /AI_RECEPTIONIST_KEY\s*=\s*"ai-receptionist"/);
  assert.doesNotMatch(service, /API\.(?:post|patch|put|delete)\s*\(/);
  assert.doesNotMatch(
    service,
    /appointment(?:s)?\/(?:create|reschedule|cancel)|createManagedAppointment|Appointment\.create/
  );

  for (const reader of [
    "getAiWorkforceRegistry",
    "listAiReceptionistRuns",
    "listAiReceptionistProposals",
    "listAiReceptionistOutcomes",
  ]) {
    assert.match(page, new RegExp(`\\b${reader}\\b`));
  }

  assert.match(page, /cannot directly create, reschedule or cancel/);
  assert.match(page, /directMutationEnabled/);
  assert.match(page, /consequentialActionsRequireProposalReview/);
  assert.match(page, /to="\/whatsapp-booking"/);
});

test("AI Receptionist is mounted behind ai:use and ai-tools and declared in canonical management navigation", async () => {
  const [app, navigation] = await Promise.all([
    source("../../../frontend/src/App.jsx"),
    source("../../../frontend/src/components/navigation/managementNavigationConfig.js"),
  ]);

  assert.match(app, /import\("\.\/pages\/AiReceptionistPage\.jsx"\)/);
  assert.match(
    app,
    /path="ai-receptionist"[\s\S]*?featurePage\(permissionPage\(AiReceptionistPage,\s*"ai:use"\),\s*"ai-tools"\)/
  );
  assert.match(
    navigation,
    /\["\/ai-receptionist",\s*"AI Receptionist"[\s\S]*?false,\s*"ai:use",\s*"ai-tools",\s*SIMPLE\]/
  );
});
