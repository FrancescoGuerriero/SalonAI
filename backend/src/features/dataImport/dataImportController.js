import {
  commitImport,
  listImportHistory,
  previewImport,
} from "./dataImportService.js";

export async function previewDataImport(request, response) {
  const preview = await previewImport(request.body || {});
  response.status(200).json({ success: true, preview });
}

export async function commitDataImport(request, response) {
  const importResult = await commitImport(request.body || {}, request.user);
  response.status(201).json({ success: true, import: importResult });
}

export async function getDataImportHistory(request, response) {
  const history = await listImportHistory(request.query || {});
  response.status(200).json({ success: true, ...history });
}
