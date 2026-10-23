import dns from "node:dns/promises";
import net from "node:net";

import { createServiceError } from "../../shared/serviceError.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function privateIpv4(address) {
  const parts = String(address).split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function privateIpv6(address) {
  const value = String(address).toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
}

function isPrivateAddress(address) {
  const version = net.isIP(address);
  return version === 4 ? privateIpv4(address) : version === 6 ? privateIpv6(address) : true;
}

export async function assertPublicSeoUrl(value, { expectedOrigin = "" } = {}) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw createServiceError("SEO crawl URL must be valid.", 422);
  }
  if (url.protocol !== "https:") {
    throw createServiceError("SEO crawling requires HTTPS URLs.", 422);
  }
  if (url.username || url.password || url.port) {
    throw createServiceError("SEO crawl URLs cannot contain credentials or a custom port.", 422);
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw createServiceError("SEO crawl host is not allowed.", 422);
  }
  if (expectedOrigin && url.origin !== expectedOrigin) {
    throw createServiceError("SEO crawler can only follow same-origin URLs.", 422);
  }

  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => isPrivateAddress(address))) {
    throw createServiceError("SEO crawl host must resolve only to public network addresses.", 422);
  }
  return url;
}

function decodeEntities(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value = "") {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeEntities(match[2].trim()) : "";
}

function firstMatch(html, expression) {
  const match = html.match(expression);
  return match ? stripTags(match[1]) : "";
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const wanted = String(name).toLowerCase();
  for (const tag of tags) {
    if ((attribute(tag, "name") || attribute(tag, "property")).toLowerCase() === wanted) {
      return attribute(tag, "content");
    }
  }
  return "";
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical")) {
      return attribute(tag, "href");
    }
  }
  return "";
}

function internalLinks(html, baseUrl) {
  const links = new Set();
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attribute(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const target = new URL(href, baseUrl);
      target.hash = "";
      if (target.protocol === "https:" && target.origin === baseUrl.origin) links.add(target.toString());
    } catch {
      // Ignore malformed links discovered in source HTML.
    }
  }
  return [...links];
}

function seoIssues(observation) {
  const issues = [];
  if (observation.statusCode >= 400) issues.push({ code: "http-error", severity: "error", message: `Page returned HTTP ${observation.statusCode}.` });
  if (!observation.title) issues.push({ code: "missing-title", severity: "error", message: "Page has no HTML title." });
  else if (observation.title.length > 65) issues.push({ code: "long-title", severity: "warning", message: "HTML title is longer than 65 characters." });
  if (!observation.metaDescription) issues.push({ code: "missing-meta-description", severity: "warning", message: "Page has no meta description." });
  else if (observation.metaDescription.length > 170) issues.push({ code: "long-meta-description", severity: "warning", message: "Meta description is longer than 170 characters." });
  if (!observation.canonicalUrl) issues.push({ code: "missing-canonical", severity: "warning", message: "Page has no canonical link." });
  if (observation.h1.length === 0) issues.push({ code: "missing-h1", severity: "warning", message: "Page has no H1 heading." });
  if (observation.h1.length > 1) issues.push({ code: "multiple-h1", severity: "info", message: "Page contains multiple H1 headings." });
  if (observation.noindex) issues.push({ code: "noindex", severity: "info", message: "Page declares noindex." });
  return issues;
}

async function readBoundedBody(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw createServiceError("SEO response exceeds the crawler size limit.", 413);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw createServiceError("SEO response exceeds the crawler size limit.", 413);
  return new TextDecoder().decode(bytes);
}

async function fetchSeoPage(startUrl, origin, redirectCount = 0) {
  const url = await assertPublicSeoUrl(startUrl, { expectedOrigin: origin });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "SalonAI-TechnicalSEO/1.0" },
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      if (redirectCount >= MAX_REDIRECTS) throw createServiceError("SEO crawl redirect limit exceeded.", 422);
      const redirected = new URL(response.headers.get("location"), url);
      return fetchSeoPage(redirected, origin, redirectCount + 1);
    }

    const contentType = response.headers.get("content-type") || "";
    const html = /text\/html|application\/xhtml\+xml/i.test(contentType) ? await readBoundedBody(response) : "";
    const robots = metaContent(html, "robots");
    const canonical = canonicalHref(html);
    const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripTags(match[1])).filter(Boolean).slice(0, 20);
    const result = {
      url: url.toString(),
      finalUrl: url.toString(),
      statusCode: response.status,
      contentType,
      title: firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
      metaDescription: metaContent(html, "description"),
      canonicalUrl: canonical ? new URL(canonical, url).toString() : "",
      robots,
      noindex: robots.toLowerCase().split(/[,\s]+/).includes("noindex"),
      h1,
      internalLinks: internalLinks(html, url),
      latencyMs: Date.now() - startedAt,
    };
    return { ...result, issues: seoIssues(result) };
  } catch (error) {
    if (error?.name === "AbortError") throw createServiceError("SEO crawl request timed out.", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function crawlTechnicalSeo(rootUrl, { maxPages = 25 } = {}) {
  const root = await assertPublicSeoUrl(rootUrl);
  const limit = Math.max(1, Math.min(100, Number(maxPages) || 25));
  const queue = [root.toString()];
  const seen = new Set();
  const pages = [];

  while (queue.length && pages.length < limit) {
    const next = queue.shift();
    if (seen.has(next)) continue;
    seen.add(next);
    const page = await fetchSeoPage(next, root.origin);
    pages.push(page);
    for (const link of page.internalLinks) {
      if (!seen.has(link) && queue.length < limit * 4) queue.push(link);
    }
  }

  return { rootUrl: root.toString(), origin: root.origin, limit, pages };
}

export default { assertPublicSeoUrl, crawlTechnicalSeo };
