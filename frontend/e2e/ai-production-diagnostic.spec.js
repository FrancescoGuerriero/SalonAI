import { expect, test } from "@playwright/test";

const targetUrl =
  process.env.SALONAI_AI_DIAGNOSTIC_URL?.trim() ||
  "https://salonai.francescopicardi.co.uk/ai/sales-forecasting";

const storageState =
  process.env.SALONAI_AI_DIAGNOSTIC_STORAGE_STATE?.trim() ||
  "playwright/.auth/salonai-production.json";

test.use({
  storageState,
});

test(
  "inspect production AI sales forecasting response",
  async ({ page }) => {
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
