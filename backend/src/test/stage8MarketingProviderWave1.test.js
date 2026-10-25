import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MARKETING_PROVIDER_ENDPOINTS,
  normaliseGoogleAdsRow,
  normaliseMetaAdsRow,
} from "../features/integrationPlatform/marketingProviderAdapters.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Google Ads v26 rows normalise into canonical campaign facts", () => {
  const record = normaliseGoogleAdsRow({
    segments: { date: "2026-10-20" },
    campaign: { id: "123", name: "Autumn colour" },
    metrics: {
      impressions: "1000",
      clicks: "42",
      costMicros: "12340000",
      conversions: "6.5",
      conversionsValue: "245.75",
    },
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "123",
    campaignName: "Autumn colour",
    impressions: 1000,
    clicks: 42,
    spend: 12.34,
    conversions: 6.5,
    revenue: 245.75,
  });
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.googleAds, "https://googleads.googleapis.com/v26");
});

test("Meta Ads rows normalise purchase actions without summing overlapping purchase aliases", () => {
  const record = normaliseMetaAdsRow({
    date_start: "2026-10-20",
    campaign_id: "456",
    campaign_name: "Rebooking",
    impressions: "2000",
    clicks: "85",
    spend: "44.50",
    actions: [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "9" },
      { action_type: "omni_purchase", value: "9" },
    ],
    action_values: [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "500.25" },
      { action_type: "omni_purchase", value: "500.25" },
    ],
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "456",
    campaignName: "Rebooking",
    impressions: 2000,
    clicks: 85,
    spend: 44.5,
    conversions: 9,
    revenue: 500.25,
  });
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.metaMarketing, "https://graph.facebook.com/v26.0");
});

test("Wave 1 provider executors remain behind the explicit source execution lock", async () => {
  const [adapters, runner] = await Promise.all([
    source("../features/integrationPlatform/marketingProviderAdapters.js"),
    source("../features/integrationPlatform/marketingProviderRunService.js"),
  ]);
  assert.match(adapters, /googleAds:searchStream/);
  assert.match(adapters, /developer-token/);
  assert.match(adapters, /login-customer-id/);
  assert.match(adapters, /META_MARKETING_ENDPOINT/);
  assert.match(adapters, /time_increment/);
  assert.match(runner, /"google_ads"/);
  assert.match(runner, /"meta_ads"/);
  const lockIndex = runner.indexOf("liveProviderExecution === false");
  const providerIndex = runner.indexOf("LIVE_PROVIDERS.has");
  assert.ok(lockIndex >= 0 && providerIndex > lockIndex, "execution lock must run before provider dispatch");
});

test("Wave 1 adapters are read-only provider reporting calls", async () => {
  const adapters = await source("../features/integrationPlatform/marketingProviderAdapters.js");
  assert.match(adapters, /FROM campaign/);
  assert.match(adapters, /\/insights/);
  assert.doesNotMatch(adapters, /campaigns\?[^\n]*method=POST/);
  assert.doesNotMatch(adapters, /mutateCampaigns/);
  assert.doesNotMatch(adapters, /budgets:mutate/);
});
