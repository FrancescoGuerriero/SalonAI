import {
  expect,
  test,
} from "@playwright/test";

import {
  redactCapturePii,
} from "./helpers/figmaCaptureRedaction.js";

test(
  "Figma capture redaction removes customer identity data",
  async ({ page }) => {
    await page.setContent(`
      <main>
        <aside>
          <h2>Choose customer</h2>

          <button type="button">
            <span class="min-w-0">
              <span class="font-semibold">Jane Example</span>
              <span class="text-xs">jane@example.com</span>
            </span>
          </button>

          <button type="button">
            <span class="min-w-0">
              <span class="font-semibold">Alex Sample</span>
              <span class="text-xs">07700 900123</span>
            </span>
          </button>

          <div>
            <p>Selected customer</p>
            <p>Jane Example</p>
            <a href="/customers/65f123abc456">
              Open customer profile
            </a>
          </div>
        </aside>

        <section>
          <h2>Jane Example customer briefing</h2>
          <p>Email jane@example.com before the appointment.</p>
          <p>Call 07700 900123 if the schedule changes.</p>
        </section>
      </main>
    `);

    const report =
      await redactCapturePii(
        page,
        {
          routePath:
            "/ai/customer-summaries",
        }
      );

    const content =
      await page.locator(
        "body"
      ).innerText();

    expect(content).not
      .toContain(
        "Jane Example"
      );

    expect(content).not
      .toContain(
        "Alex Sample"
      );

    expect(content).not
      .toContain(
        "jane@example.com"
      );

    expect(content).not
      .toContain(
        "07700 900123"
      );

    expect(content)
      .toContain(
        "Customer 01"
      );

    expect(
      await page
        .locator(
          'a[href*="/customers/"]'
        )
        .getAttribute(
          "href"
        )
    ).toBe(
      "/customers/redacted"
    );

    expect(report)
      .toMatchObject({
        enabled: true,
        remainingSensitiveValues: 0,
        remainingEmails: 0,
        remainingUkMobiles: 0,
        profileLinksRedacted: 1,
      });
  }
);
