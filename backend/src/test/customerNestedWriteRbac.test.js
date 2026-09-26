import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test(
  "nested customer workspaces separate read access from mutation authority",
  async () => {
    const segments = await source("../features/segments/segmentRoutes.js");
    const profiles = await source("../features/customerProfiles/futureCustomerProfileRoutes.js");
    const retention = await source("../features/customerProfiles/retentionActionRoutes.js");

    assert.match(
      segments,
      /\.post\([\s\S]{0,160}requirePermissions\(\s*"customer:update"\s*\)/
    );
    assert.match(
      segments,
      /\.patch\([\s\S]{0,160}requirePermissions\(\s*"customer:update"\s*\)/
    );
    assert.match(
      segments,
      /\.delete\([\s\S]{0,160}requirePermissions\(\s*"customer:update"\s*\)/
    );

    assert.match(
      profiles,
      /"\/tags"[\s\S]{0,160}requirePermissions\(\s*"customer:update"\s*\)/
    );
    assert.match(
      profiles,
      /"\/notes\/:noteId"[\s\S]{0,160}requirePermissions\(\s*"customer:delete"\s*\)/
    );
    assert.match(
      profiles,
      /"\/:customerId\/tags\/:tagId"[\s\S]{0,160}requirePermissions\(\s*"customer:update"\s*\)/
    );

    assert.match(
      retention,
      /"\/dormant\/queue"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
    assert.match(
      retention,
      /"\/follow-ups\/queue"[\s\S]{0,160}requirePermissions\(\s*"communications:manage"\s*\)/
    );
  }
);

test(
  "retention action UI only exposes queue workflows with communications manage permission",
  async () => {
    const page = await source("../../../frontend/src/pages/RetentionActionsPage.jsx");

    assert.match(
      page,
      /hasPermission\(user,\s*"communications:manage"\)/
    );
    assert.match(
      page,
      /read-only customer retention access/
    );
  }
);
