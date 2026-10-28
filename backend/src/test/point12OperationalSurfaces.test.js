import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function extractKeys(sourceText, startMarker) {
  const start = sourceText.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  const tail = sourceText.slice(start);
  const end = tail.indexOf("]);");
  assert.ok(end >= 0, `${startMarker} must be a closed array`);
  return [...tail.slice(0, end).matchAll(/\bkey:\s*"([^"]+)"/g)].map((match) => match[1]);
}

test("every commercial module declares an operational or vertical-restricted surface", async () => {
  const commercial = await source("../../../frontend/src/config/aiibpCommercialModules.js");
  const surfaces = await source("../../../frontend/src/config/aiibpModuleOperationalSurfaces.js");

  const commercialKeys = extractKeys(commercial, "export const AIIBP_COMMERCIAL_MODULES");
  const surfaceKeys = extractKeys(surfaces, "export const AIIBP_MODULE_OPERATIONAL_SURFACES");

  assert.equal(commercialKeys.length, 22);
  assert.equal(surfaceKeys.length, commercialKeys.length);
  assert.deepEqual([...surfaceKeys].sort(), [...commercialKeys].sort());
  assert.match(surfaces, /key:\s*"clinical-records"[\s\S]*?salonOperational:\s*false[\s\S]*?supportedVerticals:\s*\["plastic-surgery"\]/);
});

test("each SalonAI operational module points at a route exposed by the application workspace", async () => {
  const surfaces = await source("../../../frontend/src/config/aiibpModuleOperationalSurfaces.js");
  const app = await source("../../../frontend/src/App.jsx");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");
  const stage4 = await source("../../../frontend/src/components/stage4/Stage4WorkspaceRouter.jsx");
  const stage8 = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const searchableRoutes = `${app}\n${navigation}\n${stage4}\n${stage8}`;

  const operationalEntries = [...surfaces.matchAll(/\{\s*key:\s*"([^"]+)"[\s\S]*?primaryRoute:\s*"([^"]+)"[\s\S]*?salonOperational:\s*true\s*\}/g)];
  assert.equal(operationalEntries.length, 21);

  for (const [, key, route] of operationalEntries) {
    const pathname = route.split("?")[0];
    assert.ok(
      searchableRoutes.includes(pathname),
      `${key} must expose its primary operational route ${pathname}`
    );
  }
});

test("AI Receptionist surface keeps both staff operation and customer chatbot entry points", async () => {
  const surfaces = await source("../../../frontend/src/config/aiibpModuleOperationalSurfaces.js");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");
  const layout = await source("../../../frontend/src/components/MainLayout.jsx");
  const featureControls = await source("../services/featureControlService.js");

  assert.match(surfaces, /key:\s*"ai-receptionist"[\s\S]*?primaryRoute:\s*"\/whatsapp-booking"[\s\S]*?customerSurface:\s*"salon-chatbot"/);
  assert.match(navigation, /"\/whatsapp-booking", "WhatsApp booking"/);
  assert.match(layout, /<SalonChatbot\s*\/>/);
  assert.match(featureControls, /id:\s*"salon-chatbot"[\s\S]*?defaultEnabled:\s*true/);
});

test("clinical records remain unavailable to SalonAI and restricted by backend vertical policy", async () => {
  const capabilityRegistry = await source("../platform/capabilities/capabilityRegistry.js");
  assert.match(capabilityRegistry, /key:\s*"clinical-records"[\s\S]*?supportedVerticals:\s*\["plastic-surgery"\][\s\S]*?status:\s*"experimental"/);
});
