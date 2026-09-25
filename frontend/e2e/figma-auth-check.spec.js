import fs from "node:fs";

import { expect, test } from "@playwright/test";

const storageState =
  process.env.FIGMA_CAPTURE_STORAGE_STATE?.trim() ||
  "playwright/.auth/salonai-production.json";

const hasStorageState =
  fs.existsSync(storageState);

if (hasStorageState) {
  test.use({ storageState });
}

test("saved SalonAI authentication state reaches the dashboard", async ({ page }) => {
  test.skip(
    !hasStorageState,
    "Authenticated production storage state is local-only and is not available in CI."
  );
  await page.goto("https://salonai.francescopicardi.co.uk/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const url = new URL(page.url());

  expect(
    url.pathname,
    `Saved authentication state is not valid; browser ended on ${url.pathname}.`
  ).toBe("/dashboard");

  console.log(
    JSON.stringify(
      {
        authenticated: true,
        pathname: url.pathname,
        title: await page.title(),
      },
      null,
      2
    )
  );
});
