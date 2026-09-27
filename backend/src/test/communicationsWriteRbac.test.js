import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "communications read workspaces require manage permission for mutations",
  async () => {
    const scheduler = await source("../features/scheduler/schedulerRoutes.js");
    const campaigns = await source("../features/campaigns/campaignRoutes.js");
    const templates = await source("../features/templates/templateRoutes.js");
    const rebooking = await source("../features/rebookingCampaigns/rebookingCampaignRoutes.js");

    assert.match(
      scheduler,
      /"\/process"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
    assert.match(
      scheduler,
      /"\/:id\/cancel"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );

    for (const sourceText of [campaigns, templates, rebooking]) {
      assert.match(sourceText, /communications:manage/);
    }

    assert.match(
      campaigns,
      /\.post\([\s\S]{0,140}requirePermissions\(\s*"communications:manage"\s*\)/
    );
    assert.match(
      campaigns,
      /"\/:id\/schedule"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
    assert.match(
      templates,
      /"\/:id\/archive"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
    assert.match(
      rebooking,
      /"\/:campaignId\/send"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
  }
);

test(
  "communications management pages use the same canonical manage permission for mutation UX",
  async () => {
    const pages = [
      "../../../frontend/src/pages/ScheduledCommunicationsPage.jsx",
      "../../../frontend/src/pages/RebookingCampaignsPage.jsx",
      "../../../frontend/src/pages/CommunicationCampaignsPage.jsx",
      "../../../frontend/src/pages/CommunicationTemplatesPage.jsx",
    ];

    for (const pagePath of pages) {
      const page = await source(pagePath);
      assert.match(
        page,
        /hasPermission\(user,\s*"communications:manage"\)/
      );
    }
  }
);
