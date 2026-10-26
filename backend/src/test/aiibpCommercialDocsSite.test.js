import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const REQUIRED_MODULES = [
  "Appointments & Booking",
  "Workforce & Staff",
  "Service Catalogue",
  "Commerce",
  "Communications",
  "Calendar Integration",
  "Integration Hub",
  "CRM & Customer Intelligence",
  "Marketing",
  "Analytics & Business Intelligence",
  "Memberships",
  "Inventory & Purchasing",
  "Loyalty",
  "Clinical Records",
  "AI Business Adviser",
  "AI Receptionist",
  "AI Retention Manager",
  "AI Stylist Copilot",
];

test("AIIBP commercial documentation and website use the same module portfolio", async () => {
  const documentation = await read("docs/AIIBP_PLATFORM_DOCUMENTATION.md");
  const website = await read("docs/aiibp-platform-site/index.html");

  for (const moduleName of REQUIRED_MODULES) {
    assert.match(documentation, new RegExp(moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    assert.match(website, new RegExp(moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("AIIBP public product material does not expose inspiration-adapter branding", async () => {
  const publicFiles = [
    "docs/AIIBP_PLATFORM_DOCUMENTATION.md",
    "docs/aiibp-platform-site/index.html",
    "docs/aiibp-platform-site/styles.css",
    "docs/aiibp-platform-site/app.js",
  ];

  for (const file of publicFiles) {
    const content = await read(file);
    assert.doesNotMatch(content, /windsor/i, `${file} must use AIIBP-native product terminology`);
  }
});

test("AIIBP website communicates modular SaaS, tenant isolation and governed AI", async () => {
  const website = await read("docs/aiibp-platform-site/index.html");
  assert.match(website, /modular SaaS/i);
  assert.match(website, /tenant isolated/i);
  assert.match(website, /AI supervised/i);
  assert.match(website, /shared platform codebase/i);
  assert.match(website, /without creating software forks/i);
});
