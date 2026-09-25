import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

const nginxConfigUrls = [
  new URL(
    "../../../nginx/conf.d/salonai.conf",
    import.meta.url
  ),
  new URL(
    "../../../nginx/templates/salonai.https.conf.template",
    import.meta.url
  ),
  new URL(
    "../../../frontend/nginx/conf.d/salonai.conf",
    import.meta.url
  ),
];

test(
  "production routing keeps React AI pages separate from the Python AI service",
  async () => {
    for (const configUrl of nginxConfigUrls) {
      const config =
        await readFile(
          configUrl,
          "utf8"
        );

      assert.match(
        config,
        /location\s*=\s*\/ai\/health\s*\{/
      );

      assert.doesNotMatch(
        config,
        /location\s+\/ai\/\s*\{/
      );

      assert.match(
        config,
        /location\s+\/\s*\{[\s\S]*proxy_pass\s+http:\/\/salonai_frontend;/
      );
    }

    const backendApp =
      await readFile(
        new URL(
          "../app.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      backendApp,
      /app\.use\(\s*"\/api\/ai"/
    );

    const frontendRoutes =
      await readFile(
        new URL(
          "../../../frontend/src/App.jsx",
          import.meta.url
        ),
        "utf8"
      );

    for (const route of [
      "ai/haircare",
      "ai/customer-summaries",
      "ai/customer-segmentation",
      "ai/demand-forecasting",
      "ai/marketing-insights",
      "ai/no-show-predictions",
      "ai/sales-forecasting",
    ]) {
      assert.match(
        frontendRoutes,
        new RegExp(
          `path=["']${route.replaceAll("/", "\\/")}["']`
        )
      );
    }

    const frontendDockerfile =
      await readFile(
        new URL(
          "../../../frontend/Dockerfile.production",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      frontendDockerfile,
      /ARG VITE_AI_API_URL=\/api\/ai/
    );

    const releaseWorkflow =
      await readFile(
        new URL(
          "../../../.github/workflows/release.yml",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      releaseWorkflow,
      /VITE_AI_API_URL=\/api\/ai/
    );
  }
);
