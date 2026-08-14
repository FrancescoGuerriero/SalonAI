import { expect, test } from "@playwright/test";

test.describe("SalonAI public application", () => {
  test("loads the public homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/SalonAI/i);

    await expect(
      page.locator("body")
    ).toBeVisible();

    await expect(
      page.locator("main").first()
    ).toBeVisible();
  });

  test("has no horizontal overflow", async ({ page }) => {
    await page.goto("/");

    const hasHorizontalOverflow =
      await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

    expect(
      hasHorizontalOverflow
    ).toBe(false);
  });
});
