import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import LegacyRetentionJourney from "../features/automation/RetentionJourney.js";
import CapacityRetentionJourney from "../features/capacityPlanning/automation/RetentionJourney.js";
import PremiumRetentionJourney from "../features/premium/automation/RetentionJourney.js";

import {
  createJourney as legacyCreateJourney,
  listJourneys as legacyListJourneys,
  toggleJourney as legacyToggleJourney,
} from "../features/automation/automationController.js";
import {
  createJourney as capacityCreateJourney,
  listJourneys as capacityListJourneys,
  toggleJourney as capacityToggleJourney,
} from "../features/capacityPlanning/automation/automationController.js";

import {
  getPremiumAnalytics as legacyPremiumAnalytics,
} from "../features/analytics/premiumAnalyticsController.js";
import {
  getPremiumAnalytics as capacityPremiumAnalytics,
} from "../features/capacityPlanning/analytics/premiumAnalyticsController.js";
import {
  getPremiumAnalytics as canonicalPremiumAnalytics,
} from "../features/premium/analytics/premiumAnalyticsController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

async function source(relativePath) {
  return readFile(
    path.join(backendRoot, relativePath),
    "utf8"
  );
}

test("retention compatibility imports resolve to one canonical premium model", () => {
  assert.strictEqual(
    LegacyRetentionJourney,
    PremiumRetentionJourney
  );
  assert.strictEqual(
    CapacityRetentionJourney,
    PremiumRetentionJourney
  );

  const enabledPath =
    PremiumRetentionJourney.schema.path("enabled");
  assert.equal(enabledPath.defaultValue, false);

  const stepsPath =
    PremiumRetentionJourney.schema.path("steps");
  assert.ok(
    stepsPath.validators.some((entry) =>
      String(entry.message || "").includes(
        "between 1 and 10 steps"
      )
    ),
    "canonical journey schema must retain bounded step validation"
  );
});

test("capacity retention controllers delegate to the canonical compatibility adapter", () => {
  assert.strictEqual(
    capacityCreateJourney,
    legacyCreateJourney
  );
  assert.strictEqual(
    capacityListJourneys,
    legacyListJourneys
  );
  assert.strictEqual(
    capacityToggleJourney,
    legacyToggleJourney
  );
});

test("legacy analytics compatibility surfaces delegate to premium authority", () => {
  assert.strictEqual(
    legacyPremiumAnalytics,
    canonicalPremiumAnalytics
  );
  assert.strictEqual(
    capacityPremiumAnalytics,
    canonicalPremiumAnalytics
  );
});

test("legacy retention write adapter consumes premium normalisation service", async () => {
  const controller = await source(
    "src/features/automation/automationController.js"
  );

  assert.match(
    controller,
    /premium\/automation\/retentionAutomationService\.js/
  );
  assert.match(
    controller,
    /createRetentionJourney\(/
  );
  assert.match(
    controller,
    /updateRetentionJourney\(/
  );
  assert.doesNotMatch(
    controller,
    /RetentionJourney\.create\(request\.body\)/
  );
  assert.doesNotMatch(
    controller,
    /findByIdAndUpdate/
  );
});

test("production app mounts only premium retention and analytics route authorities", async () => {
  const app = await source("src/app.js");

  assert.match(
    app,
    /import automationRoutes from "\.\/features\/premium\/automation\/automationRoutes\.js";/
  );
  assert.match(
    app,
    /import premiumAnalyticsRoutes from "\.\/features\/premium\/analytics\/premiumAnalyticsRoutes\.js";/
  );
  assert.doesNotMatch(
    app,
    /from "\.\/features\/automation\/automationRoutes\.js"/
  );
  assert.doesNotMatch(
    app,
    /from "\.\/features\/capacityPlanning\/automation\/automationRoutes\.js"/
  );
});
