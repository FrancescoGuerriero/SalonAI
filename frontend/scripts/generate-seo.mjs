import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import {
  fileURLToPath,
} from "node:url";
import path from "node:path";

import {
  robotsDisallowPaths,
  sitemapRoutes,
} from "../src/config/seoRoutes.js";

const here = path.dirname(
  fileURLToPath(import.meta.url)
);
const publicDir = path.resolve(
  here,
  "../public"
);

function sitemapXml() {
  const body = sitemapRoutes()
    .map(
      (route) => `  <url>\n    <loc>${route.loc}</loc>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`
    )
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function robotsTxt() {
  const disallow = robotsDisallowPaths()
    .map((route) => `Disallow: ${route}`)
    .join("\n");

  return `User-agent: *\nAllow: /\n${disallow}\nSitemap: https://salonai.francescopicardi.co.uk/sitemap.xml\n`;
}

await mkdir(publicDir, {
  recursive: true,
});

await Promise.all([
  writeFile(
    path.join(publicDir, "sitemap.xml"),
    sitemapXml(),
    "utf8"
  ),
  writeFile(
    path.join(publicDir, "robots.txt"),
    robotsTxt(),
    "utf8"
  ),
]);

console.log(
  `[SEO] Generated sitemap.xml (${sitemapRoutes().length} public routes) and robots.txt.`
);
