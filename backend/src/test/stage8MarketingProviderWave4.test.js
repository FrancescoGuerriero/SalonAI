import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LINKEDIN_MARKETING_VERSION,
  META_GRAPH_VERSION,
  YOUTUBE_ANALYTICS_ENDPOINT,
  normaliseFacebookPageInsights,
  normaliseInstagramInsights,
  normaliseLinkedInPageRow,
  normaliseYouTubeRow,
} from "../features/integrationPlatform/marketingOrganicProviderAdapters.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Facebook Page insights normalise current daily view, reach, engagement and action evidence", () => {
  const records = normaliseFacebookPageInsights([
    { name: "page_media_view", values: [{ value: 1000, end_time: "2026-10-21T00:00:00+0000" }] },
    { name: "page_total_media_view_unique", values: [{ value: 750, end_time: "2026-10-21T00:00:00+0000" }] },
    { name: "page_post_engagements", values: [{ value: 90, end_time: "2026-10-21T00:00:00+0000" }] },
    { name: "page_total_actions", values: [{ value: 60, end_time: "2026-10-21T00:00:00+0000" }] },
  ], "page-1", "2026-10-20");
  assert.deepEqual(records[0], {
    date: "2026-10-21",
    contentId: "page-1",
    contentType: "facebook_page",
    impressions: 1000,
    reach: 750,
    engagements: 90,
    clicks: 60,
  });
  assert.equal(META_GRAPH_VERSION, "v26.0");
});

test("Instagram account insights normalise current views, reach and interaction totals", () => {
  const record = normaliseInstagramInsights([
    { name: "views", total_value: { value: 1500 } },
    { name: "reach", total_value: { value: 900 } },
    { name: "total_interactions", total_value: { value: 125 } },
  ], "ig-1", "2026-10-20");
  assert.deepEqual(record, {
    date: "2026-10-20",
    contentId: "ig-1",
    contentType: "instagram_account",
    impressions: 1500,
    reach: 900,
    engagements: 125,
    clicks: 0,
  });
});

test("LinkedIn Page statistics normalise daily page views and clicks", () => {
  const record = normaliseLinkedInPageRow({
    organization: "urn:li:organization:123",
    timeRange: { start: Date.parse("2026-10-20T00:00:00Z") },
    totalPageStatistics: {
      views: { allPageViews: { pageViews: 450 } },
      clicks: { allPageClicks: { pageClicks: 31 } },
    },
  });
  assert.equal(record.date, "2026-10-20");
  assert.equal(record.contentId, "urn:li:organization:123");
  assert.equal(record.impressions, 450);
  assert.equal(record.clicks, 31);
  assert.equal(LINKEDIN_MARKETING_VERSION, "202610");
});

test("YouTube Analytics rows normalise daily channel activity", () => {
  const headers = ["day", "views", "likes", "comments", "shares", "estimatedMinutesWatched", "subscribersGained", "subscribersLost"];
  const record = normaliseYouTubeRow(headers, ["2026-10-20", 2000, 110, 20, 15, 7200, 18, 2]);
  assert.deepEqual(record, {
    date: "2026-10-20",
    contentId: "channel",
    contentType: "youtube_channel",
    impressions: 2000,
    reach: 0,
    engagements: 145,
    clicks: 0,
  });
  assert.equal(YOUTUBE_ANALYTICS_ENDPOINT, "https://youtubeanalytics.googleapis.com/v2/reports");
});

test("Wave 4 adapters are read-only and use bounded current reporting endpoints", async () => {
  const adapter = await source("../features/integrationPlatform/marketingOrganicProviderAdapters.js");
  assert.match(adapter, /page_media_view,page_total_media_view_unique,page_post_engagements,page_total_actions/);
  assert.match(adapter, /views,reach,total_interactions/);
  assert.match(adapter, /organizationPageStatistics/);
  assert.match(adapter, /Linkedin-Version/);
  assert.match(adapter, /youtubeanalytics\.googleapis\.com\/v2\/reports/);
  assert.match(adapter, /maxResults/);
  assert.doesNotMatch(adapter, /feed.*method:\s*"POST"/);
  assert.doesNotMatch(adapter, /ugcPosts.*method:\s*"POST"/);
  assert.doesNotMatch(adapter, /videos.*method:\s*"POST"/);
});

test("Meta paging remains HTTPS origin-bound and Wave 4 dispatch stays behind the execution lock", async () => {
  const [adapter, runner] = await Promise.all([
    source("../features/integrationPlatform/marketingOrganicProviderAdapters.js"),
    source("../features/integrationPlatform/marketingProviderRunService.js"),
  ]);
  assert.match(adapter, /candidate\.origin !== META_GRAPH_ORIGIN/);
  assert.match(adapter, /candidate\.protocol !== "https:"/);
  assert.match(runner, /ORGANIC_WAVE4_PROVIDERS/);
  for (const provider of ["facebook_pages", "instagram_organic", "linkedin_pages", "youtube_analytics"]) {
    assert.match(runner, new RegExp(`"${provider}"`));
  }
  const lockIndex = runner.indexOf("liveProviderExecution === false");
  const dispatchIndex = runner.indexOf("ORGANIC_WAVE4_PROVIDERS.has(source.provider)");
  assert.ok(lockIndex >= 0 && dispatchIndex > lockIndex, "execution lock must run before organic provider dispatch");
});

test("YouTube OAuth refresh remains in encrypted provider credential authority", async () => {
  const adapter = await source("../features/integrationPlatform/marketingOrganicProviderAdapters.js");
  assert.match(adapter, /GOOGLE_TOKEN_ENDPOINT/);
  assert.match(adapter, /resolveProviderCredential/);
  assert.match(adapter, /storeProviderCredential/);
  assert.match(adapter, /role: "access_token"/);
});

test("Marketing connection details expose current LinkedIn Page and YouTube reporting scopes", async () => {
  const service = await source("../features/integrationPlatform/marketingConnectedAccountsService.js");
  assert.match(service, /rw_organization_admin/);
  assert.match(service, /https:\/\/www\.googleapis\.com\/auth\/yt-analytics\.readonly/);
  assert.match(service, /https:\/\/www\.googleapis\.com\/auth\/youtube\.readonly/);
});
