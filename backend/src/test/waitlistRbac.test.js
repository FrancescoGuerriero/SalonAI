import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test(
  "waitlist mutations require operation-specific appointment permissions",
  async () => {
    const routes = await source("../features/waitlist/waitlistRoutes.js");

    assert.match(
      routes,
      /"\/expire"[\s\S]{0,160}requirePermissions\(\s*"appointment:update"\s*\)/
    );
    assert.match(
      routes,
      /\.post\([\s\S]{0,160}requirePermissions\(\s*"appointment:create"\s*\)/
    );
    assert.match(
      routes,
      /"\/:id\/convert"[\s\S]{0,200}requirePermissions\(\s*"appointment:create",\s*"appointment:update"\s*\)/
    );
    assert.match(
      routes,
      /\.patch\([\s\S]{0,160}requirePermissions\(\s*"appointment:update"\s*\)/
    );
    assert.match(
      routes,
      /\.delete\([\s\S]{0,160}requirePermissions\(\s*"appointment:cancel"\s*\)/
    );
  }
);

test(
  "waitlist page derives mutation controls from canonical appointment permissions",
  async () => {
    const page = await source("../../../frontend/src/pages/WaitlistPage.jsx");

    for (const permission of [
      "appointment:create",
      "appointment:update",
      "appointment:cancel",
    ]) {
      assert.match(
        page,
        new RegExp(`hasPermission\\(user,\\s*"${permission.replace(":", "\\:")}"\\)`)
      );
    }

    assert.match(page, /canConvertWaitlist\s*=\s*canCreateAppointments\s*&&\s*canUpdateAppointments/);
  }
);
