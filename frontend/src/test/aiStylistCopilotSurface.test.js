import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(src, relativePath), "utf8");
}

test("Stylist Copilot workspace exposes advisory safety boundaries", () => {
  const page = read("pages/StylistCopilotPage.jsx");
  assert.match(page, /Stylist Copilot/);
  assert.match(page, /advisory only/);
  assert.match(page, /Human review/);
  assert.match(page, /Canonical writes/);
  assert.match(page, /Safety override/);
});

test("Stylist Copilot UI only requests canonical appointment-scoped endpoint", () => {
  const service = read("Services/aiStylistCopilotService.js");
  assert.match(service, /\/ai\/stylist-copilot\/appointments\//);
  assert.doesNotMatch(service, /customerId=/);
  assert.doesNotMatch(service, /sensitiveContext=/);
});

test("Stylist Copilot is registered as an authorised AI management workspace", () => {
  const router = read("components/stage4/Stage4WorkspaceRouter.jsx");
  const navigation = read("components/navigation/managementNavigationConfig.js");

  assert.match(router, /pathname === "\/stylist-copilot"/);
  assert.match(router, /hasPermission\(user, "ai:use"\)/);
  assert.match(router, /isFeatureEnabled\("ai-tools"\)/);
  assert.match(router, /<StylistCopilotPage \/>/);

  assert.match(navigation, /"\/stylist-copilot"/);
  assert.match(navigation, /"Stylist copilot"/);
  assert.match(navigation, /"ai:use"/);
  assert.match(navigation, /"ai-tools"/);
});
