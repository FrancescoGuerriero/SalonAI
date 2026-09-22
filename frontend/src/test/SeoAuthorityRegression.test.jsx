import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function source(relativePath) {
  return fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8"
  );
}

describe("SEO authority", () => {
  it("uses the central SEO route contract for route metadata and accessibility announcements", () => {
    const announcer = source(
      "src/components/accessibility/RouteAnnouncer.jsx"
    );

    expect(announcer).toContain(
      'from "../../config/seoRoutes.js"'
    );
    expect(announcer).toContain("seoForPath(location.pathname)");
    expect(announcer).toContain('ensureMeta("description", seo.description)');
    expect(announcer).toContain('ensureMeta("robots", seo.robots)');
    expect(announcer).toContain("ensureCanonical(seo.canonical)");
    expect(announcer).not.toContain("function pageTitle(");
  });

  it("generates robots and sitemap from the same browser-independent SEO registry", () => {
    const generator = source("scripts/generate-seo.mjs");
    const packageJson = source("package.json");

    expect(generator).toContain('from "../src/config/seoRoutes.js"');
    expect(generator).toContain("sitemapRoutes()");
    expect(generator).toContain("robotsDisallowPaths()");
    expect(packageJson).toContain('"prebuild": "npm run seo:generate"');
    expect(packageJson).toContain('"seo:generate": "node scripts/generate-seo.mjs"');
  });

  it("keeps private management URLs out of the checked-in sitemap and crawler allow-list", () => {
    const sitemap = source("public/sitemap.xml");
    const robots = source("public/robots.txt");

    expect(sitemap).toContain("/services</loc>");
    expect(sitemap).toContain("/stylists</loc>");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/dashboard");
    expect(sitemap).not.toContain("/account");

    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /manage");
    expect(robots).toContain("Disallow: /account");
    expect(robots).toContain(
      "Sitemap: https://salonai.francescopicardi.co.uk/sitemap.xml"
    );
  });
});
