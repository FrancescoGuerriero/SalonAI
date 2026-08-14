import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = [
  {
    name: "home",
    path: "/",
  },
  {
    name: "about",
    path: "/about",
  },
  {
    name: "services",
    path: "/services",
  },
  {
    name: "stylists",
    path: "/stylists",
  },
  {
    name: "login",
    path: "/login",
  },
  {
    name: "register",
    path: "/register",
  },
  {
    name: "shop",
    path: "/shop",
  },
];

test.describe("SalonAI accessibility", () => {
  for (const publicPage of publicPages) {
    test(`${publicPage.name} has no serious accessibility violations`, async ({
      page,
    }) => {
      await page.goto(publicPage.path);

      await page.waitForLoadState("domcontentloaded");

      const results = await new AxeBuilder({
        page,
      })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
        ])
        .analyze();

      const seriousViolations =
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(
            violation.impact
          )
        );

      expect(
        seriousViolations,
        JSON.stringify(
          seriousViolations,
          null,
          2
        )
      ).toEqual([]);
    });
  }
});
