import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyseSeoObservations } from "../features/integrationPlatform/marketingSeoAuditService.js";

const pages = [
  {
    url: "https://example.org/",
    statusCode: 200,
    title: "Home",
    canonicalUrl: "https://example.org/",
    noindex: false,
    internalLinks: ["https://example.org/missing"],
    issues: [{ code: "missing-meta-description", severity: "warning", message: "Page has no meta description." }],
  },
  {
    url: "https://example.org/services",
    statusCode: 200,
    title: "Home",
    canonicalUrl: "https://example.org/",
    noindex: false,
    internalLinks: [],
    issues: [],
  },
  {
    url: "https://example.org/missing",
    statusCode: 404,
    title: "",
    canonicalUrl: "",
    noindex: true,
    internalLinks: [],
    issues: [{ code: "http-error", severity: "error", message: "Page returned HTTP 404." }],
  },
];

test("SEO report finds broken internal links, duplicate titles and canonical consolidation only from scanned evidence", () => {
  const report = analyseSeoObservations(pages);
  assert.equal(report.pagesScanned, 3);
  assert.equal(report.indexableCandidates, 2);
  assert.equal(report.noindexPages, 1);
  for (const code of ["broken-internal-link", "duplicate-title", "shared-canonical", "http-error"]) {
    assert.ok(report.findings.some(f => f.code === code), code);
  }
  assert.equal(report.findings[0].severity, "error");
  assert.match(report.coverage, /Scanned pages only/);
});

test("SEO report does not invent unverified missing link failures or ranking scores", () => {
  const report = analyseSeoObservations([{
    url: "https://example.org/",
    statusCode: 200, title: "Homepage",
    canonicalUrl: "https://example.org/",
    internalLinks: ["https://example.org/not-crawled"],
    issues: [],
  }]);
  assert.equal(report.findings.some(f => f.code === "broken-internal-link"), false);
  assert.equal(report.score, undefined);
  assert.equal(analyseSeoObservations([]).pagesScanned, 0);
});

test("SEO audit endpoint requires existing Marketing module authority and scoped source/run lookup", async () => {
  const [routes, service, controller, ui] = await Promise.all([
    readFile(new URL("../features/integrationPlatform/marketingDataCoreRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../features/integrationPlatform/marketingSeoAuditService.js", import.meta.url), "utf8"),
    readFile(new URL("../features/integrationPlatform/marketingDataCoreController.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/MarketingModulePage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/seo-audit",[\s\S]*?trustedTenantContextMiddleware,[\s\S]*?effectiveAuthorityMiddleware,[\s\S]*?requireCommercialModule\("marketing"\),[\s\S]*?read,[\s\S]*?asyncHandler\(controller\.seoAudit\)/);
  assert.match(service, /MarketingDataSource\.findOne\(\{\s*_id: sourceId, business: businessId, location: locationId, provider: "technical_seo"/);
  assert.match(service, /MarketingSyncRun\.findOne\(\{\s*\.\.\.scope, mode: "seo_scan", status:/);
  assert.match(service, /SeoPageObservation\.find\(\{\s*\.\.\.scope, run: latestRun\._id/);
  assert.match(controller, /getMarketingSeoAudit\(sourceId, scope\(request\)\)/);
  assert.match(ui, /<MarketingSeoAuditPanel \/>/);
});
