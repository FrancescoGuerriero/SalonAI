import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("module operations workspace indexes the commercial catalogue without changing dashboard ownership", async () => {
  const page = await source("../../../frontend/src/pages/ModuleOperationsPage.jsx");
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");

  assert.match(page, /AIIBP_COMMERCIAL_MODULES/);
  assert.match(page, /AIIBP_MODULE_OPERATIONAL_SURFACE_BY_KEY/);
  assert.match(page, /Module Operations/);
  assert.match(page, /Open module/);
  assert.match(page, /Vertical restricted/);
  assert.match(router, /pathname === "\/admin\/system\/modules"/);
  assert.match(router, /<ModuleOperationsPage\s*\/>/);
  assert.match(navigation, /"\/admin\/system\/modules", "Module Operations"/);
});

test("module operations workspace keeps clinical records restricted for SalonAI", async () => {
  const page = await source("../../../frontend/src/pages/ModuleOperationsPage.jsx");
  const surfaces = await source("../../../frontend/src/config/aiibpModuleOperationalSurfaces.js");

  assert.match(page, /surface\?\.reason/);
  assert.match(surfaces, /key:\s*"clinical-records"[\s\S]*?salonOperational:\s*false/);
  assert.match(surfaces, /supportedVerticals:\s*\["plastic-surgery"\]/);
});
