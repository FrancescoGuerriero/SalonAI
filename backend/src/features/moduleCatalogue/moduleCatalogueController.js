import {
  MODULE_CATEGORIES,
  listModuleCatalogue,
  inspectModuleCatalogueStatus,
  validateModuleCatalogueIntegrity,
} from "../../platform/moduleCatalogue/canonicalModuleCatalogue.js";

/**
 * Read-only administrative planning catalogue. No client-supplied evidence
 * is accepted and no tenant configuration or entitlement is mutated.
 * Runtime acceptance remains unknown until independently verified.
 */
export function getAdministrativeModuleCatalogue({ includeCandidates = true } = {}) {
  const integrity = validateModuleCatalogueIntegrity();
  const entries = listModuleCatalogue({ includeCandidates }).map((entry) => ({
    ...entry,
    status: inspectModuleCatalogueStatus(entry.moduleId),
  }));
  return Object.freeze({
    readOnly: true,
    source: "AIIBP v3 requirement taxonomy (planning baseline)",
    statusEvidence: "not independently verified",
    categories: MODULE_CATEGORIES,
    integrity,
    entries,
  });
}

export function moduleCatalogueController(_request, response) {
  return response.status(200).json({
    success: true,
    catalogue: getAdministrativeModuleCatalogue(),
  });
}
