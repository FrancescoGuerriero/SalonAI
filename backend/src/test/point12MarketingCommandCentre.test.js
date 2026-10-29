import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Marketing command centre exposes priority advertising, measurement and communications providers", async () => {
  const page = await source("../../../frontend/src/pages/MarketingModulePage.jsx");
  const registry = await source("../../../frontend/src/config/providerConnectionRegistry.js");

  for (const provider of [
    "google_ads",
    "facebook",
    "microsoft_ads",
    "apple_search_ads",
    "ga4",
    "google_tag_manager",
    "google_search_console",
    "bing_webmaster",
    "sendgrid",
    "twilio",
  ]) {
    assert.match(registry, new RegExp(`key:\\s*"${provider}"`));
  }

  assert.match(page, /Marketing Command Centre/);
  assert.match(page, /Advertising accounts/);
  assert.match(page, /Measurement & analytics/);
  assert.match(page, /Marketing communications/);
  assert.match(page, /Email, SMS & WhatsApp marketing/);
  assert.match(page, /Manage all connections/);
  assert.match(page, /\/admin\/system\/connections/);
});

test("Marketing command centre preserves CRM and Communications canonical ownership", async () => {
  const page = await source("../../../frontend/src/pages/MarketingModulePage.jsx");
  const capabilities = await source("../platform/capabilities/capabilityRegistry.js");

  assert.match(page, /CRM remains the customer authority/);
  assert.match(page, /Communications remains the Email, SMS and WhatsApp delivery authority/);
  assert.match(page, /Marketing defines the audience, campaign and journey/);

  assert.match(capabilities, /key:\s*"communications"[\s\S]*?Own consent-aware inbound\/outbound message delivery/);
  assert.match(capabilities, /key:\s*"crm"[\s\S]*?Own Customer 360/);
  assert.match(capabilities, /key:\s*"marketing"[\s\S]*?marketing module/);
});

test("Marketing command centre does not fabricate analytics before canonical source evidence exists", async () => {
  const page = await source("../../../frontend/src/pages/MarketingModulePage.jsx");

  assert.match(page, /Awaiting connected data/);
  assert.match(page, /Canonical KPI surfaces populate only from connected, tenant-scoped evidence/);
  assert.match(page, /Provider metrics are retained with source provenance/);
});

test("Marketing AI remains advisory and provider writes remain governed", async () => {
  const page = await source("../../../frontend/src/pages/MarketingModulePage.jsx");

  assert.match(page, /AI may analyse campaign evidence/);
  assert.match(page, /cannot expose provider secrets/);
  assert.match(page, /execute consequential provider writes outside approved tool and human-review policy/);
});
