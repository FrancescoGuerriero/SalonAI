import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GOOGLE_BUSINESS_PERFORMANCE_ORIGIN,
  HUBSPOT_MARKETING_EMAIL_ENDPOINT,
  MAILCHIMP_API_SUFFIX,
  normaliseGoogleBusinessPerformance,
  normaliseHubSpotEmail,
  normaliseMailchimpReport,
} from "../features/integrationPlatform/marketingFinalProviderAdapters.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Google Business Profile daily time series normalises current Performance v1 metrics", () => {
  const series = [
    {
      dailyMetricTimeSeries: [
        {
          dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
          timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 }, value: "100" }] },
        },
        {
          dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
          timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 }, value: "250" }] },
        },
        {
          dailyMetric: "WEBSITE_CLICKS",
          timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 }, value: "32" }] },
        },
        {
          dailyMetric: "CALL_CLICKS",
          timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 }, value: "14" }] },
        },
        {
          dailyMetric: "BUSINESS_DIRECTION_REQUESTS",
          timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 }, value: "9" }] },
        },
      ],
    },
  ];
  assert.deepEqual(normaliseGoogleBusinessPerformance(series, "locations/123")[0], {
    date: "2026-10-20",
    locationId: "locations/123",
    locationName: "",
    views: 350,
    websiteClicks: 32,
    calls: 14,
    directionRequests: 9,
  });
  assert.equal(GOOGLE_BUSINESS_PERFORMANCE_ORIGIN, "https://businessprofileperformance.googleapis.com");
});

test("HubSpot Marketing Email stats normalise defensive counter shapes", () => {
  const record = normaliseHubSpotEmail({
    id: "email-1",
    campaign: "campaign-1",
    campaignName: "October retention",
    publishedAt: "2026-10-20T10:00:00Z",
    stats: {
      counters: {
        sent: 1000,
        uniqueOpen: { count: 420 },
        uniqueClick: { value: 88 },
        conversions: { total: 11 },
      },
    },
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "campaign-1",
    campaignName: "October retention",
    sends: 1000,
    opens: 420,
    clicks: 88,
    conversions: 11,
  });
  assert.equal(HUBSPOT_MARKETING_EMAIL_ENDPOINT, "https://api.hubapi.com/marketing/v3/emails");
});

test("Mailchimp reports normalise unique email engagement and ecommerce orders", () => {
  const record = normaliseMailchimpReport({
    id: "mc-1",
    campaign_title: "Colour offer",
    send_time: "2026-10-20T09:00:00Z",
    emails_sent: 800,
    opens: { unique_opens: 310, opens_total: 500 },
    clicks: { unique_clicks: 76, clicks_total: 140 },
    ecommerce: { total_orders: 12, total_revenue: 600 },
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    campaignId: "mc-1",
    campaignName: "Colour offer",
    sends: 800,
    opens: 310,
    clicks: 76,
    conversions: 12,
  });
  assert.equal(MAILCHIMP_API_SUFFIX, ".api.mailchimp.com");
});

test("Wave 5 adapters use current read-only provider reporting surfaces", async () => {
  const adapter = await source("../features/integrationPlatform/marketingFinalProviderAdapters.js");
  assert.match(adapter, /fetchMultiDailyMetricsTimeSeries/);
  assert.match(adapter, /BUSINESS_IMPRESSIONS_DESKTOP_MAPS/);
  assert.match(adapter, /WEBSITE_CLICKS/);
  assert.match(adapter, /marketing\/v3\/emails/);
  assert.match(adapter, /includeStats/);
  assert.match(adapter, /\/3\.0\/reports/);
  assert.match(adapter, /since_send_time/);
  assert.match(adapter, /before_send_time/);
  assert.doesNotMatch(adapter, /method:\s*"PATCH"/);
  assert.doesNotMatch(adapter, /method:\s*"DELETE"/);
});

test("Mailchimp data-centre host and HubSpot cursor stay input constrained", async () => {
  const adapter = await source("../features/integrationPlatform/marketingFinalProviderAdapters.js");
  assert.match(adapter, /\^\[a-z\]\{2\}\\d\{1,4\}\$/);
  assert.match(adapter, /MAILCHIMP_SERVER_PREFIX_INVALID/);
  assert.match(adapter, /safeHubSpotNext/);
  assert.match(adapter, /\^\[A-Za-z0-9\._~:\+\\\-\/=\]\+\$/);
});

test("Wave 5 dispatch remains behind the hard live-provider execution lock", async () => {
  const runner = await source("../features/integrationPlatform/marketingProviderRunService.js");
  assert.match(runner, /FINAL_WAVE5_PROVIDERS/);
  for (const provider of ["google_business_profile", "hubspot", "mailchimp"]) {
    assert.match(runner, new RegExp(`"${provider}"`));
  }
  const lockIndex = runner.indexOf("liveProviderExecution === false");
  const dispatchIndex = runner.indexOf("FINAL_WAVE5_PROVIDERS.has(source.provider)");
  assert.ok(lockIndex >= 0 && dispatchIndex > lockIndex, "execution lock must run before wave 5 dispatch");
});

test("Google Business Profile refresh remains in encrypted credential authority", async () => {
  const adapter = await source("../features/integrationPlatform/marketingFinalProviderAdapters.js");
  assert.match(adapter, /GOOGLE_TOKEN_ENDPOINT/);
  assert.match(adapter, /resolveProviderCredential/);
  assert.match(adapter, /storeProviderCredential/);
  assert.match(adapter, /role: "access_token"/);
});

test("HubSpot marketing-email access and Bing Webmaster form are exposed in Marketing connections", async () => {
  const [service, catalogue] = await Promise.all([
    source("../features/integrationPlatform/marketingConnectedAccountsService.js"),
    source("../features/integrationPlatform/marketingConnectorCatalogue.js"),
  ]);
  assert.match(service, /bing_webmaster: provider/);
  assert.match(service, /Bing Webmaster Tools/);
  assert.match(service, /"content"/);
  assert.match(catalogue, /key: "hubspot"/);
  assert.match(catalogue, /"content"/);
});
