import {
  createDatasetExport,
  listAuditEvents,
} from "./dataExportAuditService.js";

import { getRequestActor } from "../shared/analyticsUtils.js";

async function exportDataset(request, response) {
  const result = await createDatasetExport({
    dataset: request.params.dataset,
    format: request.query?.format,
    months: request.query?.months,
    actor: getRequestActor(request),
  });

  response.setHeader("Content-Type", result.contentType);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.filename}"`
  );
  response.setHeader("X-Record-Count", String(result.recordCount));
  return response.status(200).send(result.content);
}

async function getAuditEvents(request, response) {
  const result = await listAuditEvents(request.query);
  return response.status(200).json({ success: true, ...result });
}

export { exportDataset, getAuditEvents };
