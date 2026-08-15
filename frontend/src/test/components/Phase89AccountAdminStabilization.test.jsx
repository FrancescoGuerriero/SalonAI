import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath) {
  return fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8"
  );
}

describe("Phase 8.9 account and admin stabilization", () => {
  it("keeps profile photos and hair consultation inside account management", () => {
    const account = source("src/pages/ManageAccountPage.jsx");

    expect(account).toContain("ProfilePhotoUploader");
    expect(account).toContain("Every registered SalonAI user");
    expect(account).toContain("Hair consultation");
    expect(account).toContain("request personalised");
    expect(account).toContain("generateHaircareRecommendation");
  });

  it("supports ten thousand row customer and product CSV uploads", () => {
    const dataImport = source("src/pages/DataImportPage.jsx");

    expect(dataImport).toContain("MAXIMUM_ROWS = 10_000");
    expect(dataImport).toContain("API_BATCH_ROWS = 500");
    expect(dataImport).toContain("MAXIMUM_FILE_BYTES = 15_000_000");
    expect(dataImport).toContain("splitIntoBatches");
  });

  it("surfaces app downloads and social links in the footer", () => {
    const footer = source("src/components/Footer.jsx");
    const links = source("src/config/publicLinks.js");

    expect(footer).toContain("Get the app");
    expect(footer).toContain("Instagram");
    expect(footer).toContain("Facebook");
    expect(footer).toContain("Youtube");
    expect(links).toContain("VITE_APP_STORE_URL");
    expect(links).toContain("VITE_GOOGLE_PLAY_URL");
  });

  it("surfaces staff, product and import actions on the admin dashboard", () => {
    const dashboard = source("src/pages/AdminDashboard.jsx");

    expect(dashboard).toContain("Add or manage staff");
    expect(dashboard).toContain("Products & inventory");
    expect(dashboard).toContain("Bulk data import");
  });
});
