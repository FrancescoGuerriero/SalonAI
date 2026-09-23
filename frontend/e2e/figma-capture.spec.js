import { expect, test } from "@playwright/test";

const captureId = process.env.FIGMA_CAPTURE_ID?.trim();
const capturePath = process.env.FIGMA_CAPTURE_PATH?.trim() || "/";
const targetUrl = process.env.FIGMA_CAPTURE_TARGET_URL?.trim();
const selector = process.env.FIGMA_CAPTURE_SELECTOR?.trim() || "body";
const delayMs = Number.parseInt(process.env.FIGMA_CAPTURE_DELAY_MS || "1500", 10);
const width = Number.parseInt(process.env.FIGMA_CAPTURE_WIDTH || "1440", 10);
const height = Number.parseInt(process.env.FIGMA_CAPTURE_HEIGHT || "1000", 10);
const storageState = process.env.FIGMA_CAPTURE_STORAGE_STATE?.trim();
const stripCsp = process.env.FIGMA_CAPTURE_STRIP_CSP !== "false";
const testTimeoutMs = Number.parseInt(
  process.env.FIGMA_CAPTURE_TEST_TIMEOUT_MS || "300000",
  10
);

if (storageState) {
  test.use({ storageState });
}

test.describe("Figma UX reference capture", () => {
  test.skip(!captureId, "Set FIGMA_CAPTURE_ID to run the Figma capture utility.");

  test("capture rendered SalonAI screen into the shared Figma file", async ({ page }) => {
    test.setTimeout(
      Number.isFinite(testTimeoutMs) && testTimeoutMs >= 120000
        ? testTimeoutMs
        : 300000
    );

    await page.setViewportSize({ width, height });

    if (stripCsp) {
      await page.route("**/*", async (route) => {
        const response = await route.fetch();
        const headers = { ...response.headers() };
        delete headers["content-security-policy"];
        delete headers["content-security-policy-report-only"];
        await route.fulfill({ response, headers });
      });
    }

    await page.goto(targetUrl || capturePath, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const captureScriptResponse = await page.context().request.get(
      "https://mcp.figma.com/mcp/html-to-design/capture.js"
    );

    expect(
      captureScriptResponse.ok(),
      "Figma capture bootstrap script should be reachable."
    ).toBeTruthy();

    const captureScript = await captureScriptResponse.text();

    await page.evaluate((source) => {
      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    }, captureScript);

    await page.waitForFunction(
      () => Boolean(window.figma?.captureForDesign),
      undefined,
      { timeout: 15000 }
    );

    if (Number.isFinite(delayMs) && delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }

    const endpoint =
      `https://mcp.figma.com/mcp/capture/${captureId}/submit?bindVariables=true`;

    const captureResult = await page.evaluate(
      async ({ id, endpointUrl, captureSelector }) => {
        return window.figma.captureForDesign({
          captureId: id,
          endpoint: endpointUrl,
          selector: captureSelector,
        });
      },
      {
        id: captureId,
        endpointUrl: endpoint,
        captureSelector: selector,
      }
    );

    console.log(
      JSON.stringify(
        {
          captureId,
          source: targetUrl || capturePath,
          selector,
          viewport: { width, height },
          captureResult,
        },
        null,
        2
      )
    );
  });
});
