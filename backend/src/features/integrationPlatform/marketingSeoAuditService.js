import mongoose from "mongoose";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import MarketingSyncRun from "../../models/MarketingSyncRun.js";
import SeoPageObservation from "../../models/SeoPageObservation.js";
import { createServiceError } from "../../shared/serviceError.js";

function issue(code, severity, message, url, evidence = "") {
  return { code, severity, message, url, evidence };
}

/**
 * Deterministic, evidence-based SEO findings. This is not a search ranking score.
 * Pages must originate from one completed, scoped technical_seo scan.
 */
export function analyseSeoObservations(pages = []) {
  const findings = [];
  const titles = new Map();
  const canonicals = new Map();
  const scannedUrls = new Set(pages.map((page) => page.url));
  const broken = new Set(pages.filter((page) => page.statusCode >= 400).map((page) => page.url));

  for (const page of pages) {
    const url = page.url;
    for (const sourceIssue of page.issues || []) {
      findings.push(issue(sourceIssue.code, sourceIssue.severity, sourceIssue.message, url));
    }

    if (page.statusCode >= 200 && page.statusCode < 300 && !page.noindex) {
      const title = String(page.title || "").trim().toLowerCase();
      if (title) titles.set(title, [...(titles.get(title) || []), url]);
      const canonical = String(page.canonicalUrl || "").trim();
      if (canonical) {
        canonicals.set(canonical, [...(canonicals.get(canonical) || []), url]);
        try {
          if (new URL(canonical).origin !== new URL(url).origin) {
            findings.push(issue("external-canonical", "warning", "Canonical points to a different website; verify ownership and intent.", url, canonical));
          }
        } catch {
          findings.push(issue("invalid-canonical", "error", "Canonical URL is malformed.", url, canonical));
        }
      }
    }

    for (const link of new Set(page.internalLinks || [])) {
      if (scannedUrls.has(link) && broken.has(link)) {
        findings.push(issue("broken-internal-link", "error", "Internal link points to a scanned page returning HTTP 4xx/5xx.", url, link));
      }
    }
  }

  for (const [title, urls] of titles) {
    if (urls.length > 1) {
      for (const url of urls) {
        findings.push(issue("duplicate-title", "warning", "Multiple indexable pages share an HTML title.", url, title));
      }
    }
  }
  for (const [canonical, urls] of canonicals) {
    if (urls.length > 1) {
      for (const url of urls) {
        findings.push(issue("shared-canonical", "info", "Multiple pages point to the same canonical; review intended consolidation.", url, canonical));
      }
    }
  }

  const priority = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => priority[a.severity] - priority[b.severity] ||
    a.code.localeCompare(b.code) || a.url.localeCompare(b.url));
  return {
    pagesScanned: pages.length,
    indexableCandidates: pages.filter((page) => page.statusCode >= 200 && page.statusCode < 300 && !page.noindex).length,
    noindexPages: pages.filter((page) => page.noindex).length,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    informational: findings.filter((f) => f.severity === "info").length,
    findings,
    coverage: "Scanned pages only; unfetched links, JS-rendered content and search engine indexing are not verified.",
  };
}

export async function getMarketingSeoAudit(sourceId, { businessId, locationId } = {}) {
  if (![sourceId, businessId, locationId].every((value) => mongoose.isValidObjectId(value))) {
    throw createServiceError("Valid source, Business and Location identifiers are required.", 400);
  }

  const scope = { business: businessId, location: locationId, source: sourceId };
  const source = await MarketingDataSource.findOne({
    _id: sourceId, business: businessId, location: locationId, provider: "technical_seo",
  }).select("_id name key sourceConfig.rootUrl").lean();
  if (!source) throw createServiceError("SEO source not found in the selected Marketing workspace.", 404);

  const latestRun = await MarketingSyncRun.findOne({
    ...scope, mode: "seo_scan", status: { $in: ["succeeded", "partial"] },
  }).sort({ completedAt: -1, createdAt: -1 }).select("_id status completedAt").lean();

  if (!latestRun) {
    return {
      source: { id: String(source._id), name: source.name },
      run: null, summary: analyseSeoObservations([]),
      state: "not-scanned",
    };
  }
  const pages = await SeoPageObservation.find({
    ...scope, run: latestRun._id,
  }).sort({ url: 1 }).limit(100).lean();
  return {
    source: { id: String(source._id), name: source.name },
    run: { id: String(latestRun._id), status: latestRun.status, completedAt: latestRun.completedAt },
    state: "ready",
    summary: analyseSeoObservations(pages),
  };
}
