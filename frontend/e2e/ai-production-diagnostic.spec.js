import fs from "node:fs";

import { expect, test } from "@playwright/test";

const targetUrl =
  process.env.SALONAI_AI_DIAGNOSTIC_URL?.trim() ||
  "https://salonai.francescopicardi.co.uk/ai/sales-forecasting";

const storageState =
  process.env.SALONAI_AI_DIAGNOSTIC_STORAGE_STATE?.trim() ||
  "playwright/.auth/salonai-production.json";

const hasStorageState =
  fs.existsSync(storageState);

if (hasStorageState) {
  test.use({
    storageState,
  });
}

test(
  "inspect production AI sales forecasting response",
  async ({ page }) => {
    test.skip(
      !hasStorageState,
      "Authenticated production storage state is local-only and is not available in CI."
    );

    const responsePromise =
      page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              "/api/ai/sales-forecast"
            ),
        {
          timeout: 30_000,
        }
      );

    await page.goto(
      targetUrl,
      {
        waitUntil:
          "domcontentloaded",
      }
    );

    const response =
      await responsePromise;

    let body;

    try {
      body =
        await response.json();
    } catch {
      body =
        await response.text();
    }

    expect(
      response.ok(),
      `Production sales forecast request failed with HTTP ${response.status()}.`
    ).toBeTruthy();

    if (
      body &&
      typeof body === "object"
    ) {
      const forecasts =
        body?.forecast?.forecasts ||
        body?.forecasts ||
        body?.data?.forecasts ||
        [];

      if (
        Array.isArray(
          forecasts
        )
      ) {
        const conflictingDates =
          forecasts
            .filter(
              (item) =>
                item?.is_peak_day ===
                  true &&
                item?.is_quiet_day ===
                  true
            )
            .map(
              (item) =>
                item.forecast_date
            );

        expect(
          conflictingDates,
          "No production sales forecast date may be classified as both peak and quiet."
        ).toEqual([]);
      }
    }

    console.log(
      JSON.stringify(
        {
          url:
            response.url(),

          status:
            response.status(),

          ok:
            response.ok(),

          body,
        },
        null,
        2
      )
    );

    expect(
      new URL(page.url())
        .pathname
    ).toBe(
      "/ai/sales-forecasting"
    );
  }
);
