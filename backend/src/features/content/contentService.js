import ContentPage from "./ContentPage.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || undefined;
}

function businessId(request) {
  return request?.effectiveAuthority?.businessId || request?.tenantContext?.businessId || undefined;
}

function safeUrl(value) {
  const result = text(value, 1500);
  if (!result) return "";
  if (result.startsWith("/") || /^https:\/\//i.test(result)) return result;
  throw createServiceError("Content links and media URLs must use HTTPS or an application-relative path.", 422);
}

function normaliseBlock(block = {}) {
  const type = text(block.type, 30).toLowerCase();
  if (!["heading", "paragraph", "image", "call_to_action"].includes(type)) {
    throw createServiceError("Content block type is invalid.", 422);
  }

  const result = {
    type,
    text: text(block.text),
    level: Math.max(2, Math.min(4, Number(block.level) || 2)),
    label: text(block.label, 120),
    href: safeUrl(block.href),
  };

  if (type === "image") {
    const url = safeUrl(block.media?.url);
    const alt = text(block.media?.alt, 300);
    if (!url || !alt) {
      throw createServiceError("Image blocks require a URL and meaningful alternative text.", 422);
    }
    result.media = {
      url,
      alt,
      width: Number(block.media?.width) || undefined,
      height: Number(block.media?.height) || undefined,
      variants: (block.media?.variants || []).map((variant) => ({
        url: safeUrl(variant.url),
        width: Number(variant.width),
      })).filter((variant) => variant.url && variant.width > 0),
    };
  }

  if (type === "call_to_action" && (!result.label || !result.href)) {
    throw createServiceError("Call-to-action blocks require a label and destination.", 422);
  }

  return result;
}

function normaliseLocales(locales = []) {
  if (!Array.isArray(locales) || locales.length === 0) {
    throw createServiceError("At least one content locale is required.", 422);
  }

  const seen = new Set();
  return locales.map((entry) => {
    const locale = text(entry.locale, 20) || "en-GB";
    if (seen.has(locale)) throw createServiceError(`Duplicate content locale: ${locale}.`, 422);
    seen.add(locale);
    const title = text(entry.title, 180);
    if (!title) throw createServiceError(`A title is required for ${locale}.`, 422);
    return {
      locale,
      title,
      summary: text(entry.summary, 500),
      seoTitle: text(entry.seoTitle, 180),
      seoDescription: text(entry.seoDescription, 320),
      blocks: (entry.blocks || []).map(normaliseBlock),
    };
  });
}

function snapshot(page) {
  return {
    slug: page.slug,
    defaultLocale: page.defaultLocale,
    locales: page.locales.map((entry) => entry.toObject ? entry.toObject() : entry),
  };
}

function pageQuery(request, extra = {}) {
  const business = businessId(request);
  return business ? { business, ...extra } : { business: { $exists: false }, ...extra };
}

export async function listContentPages(request) {
  return ContentPage.find(pageQuery(request)).sort({ updatedAt: -1 }).lean();
}

export async function createContentPage(payload, request) {
  const slug = text(payload.slug, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createServiceError("Content slug must be URL-safe.", 422);
  }
  const locales = normaliseLocales(payload.locales);
  const page = new ContentPage({
    business: businessId(request),
    slug,
    defaultLocale: text(payload.defaultLocale, 20) || locales[0].locale,
    locales,
    createdBy: actorId(request.user),
    updatedBy: actorId(request.user),
  });
  page.versions.push({ version: 1, snapshot: snapshot(page), createdBy: actorId(request.user) });
  await page.save();
  return page;
}

export async function updateContentPage(pageId, payload, request) {
  const page = await ContentPage.findOne(pageQuery(request, { _id: pageId }));
  if (!page) throw createServiceError("Content page not found.", 404);
  if (payload.slug !== undefined) page.slug = text(payload.slug, 160).toLowerCase();
  if (payload.defaultLocale !== undefined) page.defaultLocale = text(payload.defaultLocale, 20);
  if (payload.locales !== undefined) page.locales = normaliseLocales(payload.locales);
  page.currentVersion += 1;
  page.updatedBy = actorId(request.user);
  page.versions.push({
    version: page.currentVersion,
    snapshot: snapshot(page),
    createdBy: actorId(request.user),
  });
  await page.save();
  return page;
}

export async function publishContentPage(pageId, request) {
  const page = await ContentPage.findOne(pageQuery(request, { _id: pageId }));
  if (!page) throw createServiceError("Content page not found.", 404);
  if (!page.locales.length) throw createServiceError("Content cannot be published without a locale.", 409);
  page.status = "published";
  page.publishedAt = new Date();
  page.publishedBy = actorId(request.user);
  page.updatedBy = actorId(request.user);
  await page.save();
  return page;
}

export async function archiveContentPage(pageId, request) {
  const page = await ContentPage.findOne(pageQuery(request, { _id: pageId }));
  if (!page) throw createServiceError("Content page not found.", 404);
  page.status = "archived";
  page.updatedBy = actorId(request.user);
  await page.save();
  return page;
}

export async function previewContentPage(pageId, locale, request) {
  const page = await ContentPage.findOne(pageQuery(request, { _id: pageId })).lean();
  if (!page) throw createServiceError("Content page not found.", 404);
  return localisedView(page, locale);
}

export async function publishedContentPage(slug, locale, request = null) {
  const page = await ContentPage.findOne(pageQuery(request, {
    slug: text(slug, 160).toLowerCase(),
    status: "published",
  })).lean();
  if (!page) throw createServiceError("Published content page not found.", 404);
  return localisedView(page, locale);
}

export function localisedView(page, requestedLocale) {
  const locale = text(requestedLocale, 20) || page.defaultLocale || "en-GB";
  const content = page.locales.find((entry) => entry.locale === locale)
    || page.locales.find((entry) => entry.locale === page.defaultLocale)
    || page.locales[0];
  if (!content) throw createServiceError("Content locale is unavailable.", 404);
  return {
    id: page._id,
    slug: page.slug,
    status: page.status,
    locale: content.locale,
    defaultLocale: page.defaultLocale,
    title: content.title,
    summary: content.summary,
    seoTitle: content.seoTitle || content.title,
    seoDescription: content.seoDescription || content.summary,
    blocks: content.blocks || [],
    version: page.currentVersion,
    publishedAt: page.publishedAt,
  };
}

export default {
  archiveContentPage,
  createContentPage,
  listContentPages,
  previewContentPage,
  publishContentPage,
  publishedContentPage,
  updateContentPage,
};
