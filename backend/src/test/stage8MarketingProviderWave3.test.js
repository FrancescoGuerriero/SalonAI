import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LINKEDIN_MARKETING_VERSION,
  MICROSOFT_REPORT_POLL_ENDPOINT,
  MICROSOFT_REPORT_SUBMIT_ENDPOINT,
  TIKTOK_REPORT_ENDPOINT,
  normaliseLinkedInAdsRow,
  normaliseMicrosoftAdsRow,
  normaliseTikTokAdsRow,
} from "../features/integrationPlatform/marketingAdvertisingProviderAdapters.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("LinkedIn Ads rows normalise current adAnalytics campaign facts", () => {
  const record = normaliseLinkedInAdsRow({
    dateRange: { start: { year: 2026, month: 10, day: 20 } },
    pivotValues: ["urn:li:sponsoredCampaign:123456"],
    impressions: 1000,
    clicks: 42,
    costInLocalCurrency: "25.50",
    externalWebsiteConversions: "5",
    conversionValueInLocalCurrency: "210.75",
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "123456",
    campaignName: "",
    impressions: 1000,
    clicks: 42,
    spend: 25.5,
    conversions: 5,
    revenue: 210.75,
  });
  assert.equal(LINKEDIN_MARKETING_VERSION, "202610");
});

test("Microsoft Advertising campaign rows normalise CSV reporting values", () => {
  const record = normaliseMicrosoftAdsRow({
    TimePeriod: "2026-10-20",
    CampaignId: "789",
    CampaignName: "Autumn campaign",
    Impressions: "1,500",
    Clicks: "65",
    Spend: "£48.25",
    Conversions: "7.5",
    Revenue: "£350.10",
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "789",
    campaignName: "Autumn campaign",
    impressions: 1500,
    clicks: 65,
    spend: 48.25,
    conversions: 7.5,
    revenue: 350.1,
  });
  assert.match(MICROSOFT_REPORT_SUBMIT_ENDPOINT, /GenerateReport\/Submit$/);
  assert.match(MICROSOFT_REPORT_POLL_ENDPOINT, /GenerateReport\/Poll$/);
});

test("TikTok Ads rows normalise synchronous report dimensions and metrics", () => {
  const record = normaliseTikTokAdsRow({
    dimensions: { campaign_id: "9988", stat_time_day: "2026-10-20 00:00:00" },
    metrics: {
      campaign_name: "Colour video",
      impressions: "2500",
      clicks: "120",
      spend: "55.40",
      conversion: "11",
      total_purchase_value: "490.80",
    },
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "9988",
    campaignName: "Colour video",
    impressions: 2500,
    clicks: 120,
    spend: 55.4,
    conversions: 11,
    revenue: 490.8,
  });
  assert.match(TIKTOK_REPORT_ENDPOINT, /\/open_api\/v2\.0\/report\/integrated\/get\/$/);
});

test("Wave 3 advertising adapters use current read-only reporting contracts", async () => {
  const adapter = await source("../features/integrationPlatform/marketingAdvertisingProviderAdapters.js");
  assert.match(adapter, /\/rest\/adAnalytics/);
  assert.match(adapter, /Linkedin-Version/);
  assert.match(adapter, /X-Restli-Protocol-Version/);
  assert.match(adapter, /CampaignPerformanceReportRequest/);
  assert.match(adapter, /GenerateReport\/Submit/);
  assert.match(adapter, /GenerateReport\/Poll/);
  assert.match(adapter, /\/report\/integrated\/get\//);
  assert.doesNotMatch(adapter, /mutateCampaigns/);
  assert.doesNotMatch(adapter, /campaignCreate/);
  assert.doesNotMatch(adapter, /campaign\/create/);
  assert.doesNotMatch(adapter, /budget\/update/);
});

test("Wave 3 dispatch remains behind the hard execution lock", async () => {
  const runner = await source("../features/integrationPlatform/marketingProviderRunService.js");
  assert.match(runner, /ADVERTISING_WAVE3_PROVIDERS/);
  for (const provider of ["linkedin_ads", "microsoft_ads", "tiktok_ads"]) assert.match(runner, new RegExp(`"${provider}"`));
  const lockIndex = runner.indexOf("liveProviderExecution === false");
  const dispatchIndex = runner.indexOf("ADVERTISING_WAVE3_PROVIDERS.has(source.provider)");
  assert.ok(lockIndex >= 0 && dispatchIndex > lockIndex, "execution lock must run before wave 3 dispatch");
});

test("LinkedIn pagination is origin-bound and Microsoft token refresh uses msads.manage", async () => {
  const adapter = await source("../features/integrationPlatform/marketingAdvertisingProviderAdapters.js");
  assert.match(adapter, /candidate\.origin !== LINKEDIN_ORIGIN/);
  assert.match(adapter, /candidate\.pathname\.startsWith\("\/rest\/adAnalytics"\)/);
  assert.match(adapter, /https:\/\/ads\.microsoft\.com\/msads\.manage offline_access/);
  assert.match(adapter, /role: "refresh_token"/);
});
