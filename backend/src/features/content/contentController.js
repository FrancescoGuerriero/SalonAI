import * as service from "./contentService.js";

export async function listPages(request, response) {
  return response.json({ success: true, pages: await service.listContentPages(request) });
}

export async function createPage(request, response) {
  const page = await service.createContentPage(request.body || {}, request);
  return response.status(201).json({ success: true, page });
}

export async function updatePage(request, response) {
  return response.json({
    success: true,
    page: await service.updateContentPage(request.params.id, request.body || {}, request),
  });
}

export async function publishPage(request, response) {
  return response.json({ success: true, page: await service.publishContentPage(request.params.id, request) });
}

export async function archivePage(request, response) {
  return response.json({ success: true, page: await service.archiveContentPage(request.params.id, request) });
}

export async function previewPage(request, response) {
  return response.json({
    success: true,
    page: await service.previewContentPage(request.params.id, request.query.locale, request),
  });
}

export async function publicPage(request, response) {
  return response.json({
    success: true,
    page: await service.publishedContentPage(request.params.slug, request.query.locale, request),
  });
}

export default {
  archivePage,
  createPage,
  listPages,
  previewPage,
  publicPage,
  publishPage,
  updatePage,
};
