import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_SEO_ROUTES,
  canonicalUrlForPath,
  robotsDisallowPaths,
  seoForPath,
  sitemapRoutes,
} from "../config/seoRoutes.js";

test("public SEO routes are unique and indexable", () => {
  const paths = PUBLIC_SEO_ROUTES.map((route) => route.path);

  assert.equal(
    new Set(paths).size,
    paths.length
  );

  for (const route of PUBLIC_SEO_ROUTES) {
    const seo = seoForPath(route.path);
    assert.equal(seo.indexable, true);
    assert.match(seo.robots, /^index,follow/);
    assert.equal(
      seo.canonical,
      canonicalUrlForPath(route.path)
    );
  }
});

test("dynamic product routes are indexable without exposing account routes", () => {
  assert.equal(
    seoForPath("/shop/example-product").indexable,
    true
  );

  for (const path of [
    "/account",
    "/settings",
    "/checkout",
    "/orders",
    "/dashboard",
    "/manage/services",
    "/admin/employees",
    "/customers/123",
    "/calendar",
    "/ai/haircare",
    "/unknown-route",
  ]) {
    const seo = seoForPath(path);
    assert.equal(seo.indexable, false);
    assert.equal(seo.robots, "noindex,nofollow");
  }
});

test("canonical URLs strip query strings, fragments and trailing slashes", () => {
  assert.equal(
    canonicalUrlForPath("/services/?utm_source=test#top"),
    "https://salonai.francescopicardi.co.uk/services"
  );
});

test("sitemap only contains explicitly indexable static routes", () => {
  const entries = sitemapRoutes();

  assert.equal(entries.length, PUBLIC_SEO_ROUTES.length);
  assert.equal(
    entries.some((entry) => entry.path === "/account"),
    false
  );
  assert.equal(
    entries.some((entry) => entry.path.includes(":")),
    false
  );
  assert.equal(
    entries.every((entry) => entry.loc.startsWith("https://salonai.francescopicardi.co.uk/")),
    true
  );
});

test("robots disallow list covers sensitive customer and management areas", () => {
  const disallow = robotsDisallowPaths();

  for (const path of [
    "/account",
    "/checkout",
    "/dashboard",
    "/manage",
    "/admin",
    "/customers",
    "/appointments",
    "/calendar",
    "/ai",
  ]) {
    assert.equal(disallow.includes(path), true);
  }
});
