import {
  commitImport,
  listImportHistory,
  previewImport,
} from "./dataImportService.js";

function isBatchRequest(payload = {}) {
  return /-batch-\d+$/i.test(
    String(payload.fileName || "")
  );
}

function skippedBatchResult(payload, preview) {
  const results = (preview.results || []).map(
    (result) => ({
      ...result,
      status:
        result.action === "skip"
          ? "skipped"
          : result.status,
    })
  );

  return {
    entityType: preview.entityType,
    duplicatePolicy:
      preview.duplicatePolicy,
    fileName:
      String(payload.fileName || "salonai-import.csv"),
    status: "completed",
    summary: {
      total: Number(
        preview.summary?.total || 0
      ),
      created: 0,
      updated: 0,
      skipped: Number(
        preview.summary?.skipped || 0
      ),
      failed: Number(
        preview.summary?.errors || 0
      ),
    },
    results,
  };
}

export async function previewDataImport(request, response) {
  const preview = await previewImport(request.body || {});
  response.status(200).json({ success: true, preview });
}

export async function commitDataImport(request, response) {
  const payload = request.body || {};

  try {
    const importResult = await commitImport(
      payload,
      request.user
    );

    response.status(201).json({
      success: true,
      import: importResult,
    });
  } catch (error) {
    if (
      error?.code ===
        "IMPORT_HAS_NO_CHANGES" &&
      isBatchRequest(payload)
    ) {
      const preview = await previewImport(
        payload
      );

      return response.status(200).json({
        success: true,
        import: skippedBatchResult(
          payload,
          preview
        ),
      });
    }

    throw error;
  }
}

export async function getDataImportHistory(request, response) {
  const history = await listImportHistory(request.query || {});
  response.status(200).json({ success: true, ...history });
}
