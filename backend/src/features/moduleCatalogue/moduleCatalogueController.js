import {
  MODULE_CATEGORIES,
  listModuleCatalogue,
  inspectModuleCatalogueStatus,
  validateModuleCatalogueIntegrity,
} from "../../platform/moduleCatalogue/canonicalModuleCatalogue.js";
import {
  listVerifiedModuleDeliveryEvidence,
  inspectModuleDeliveryMilestones,
  validateModuleDeliveryEvidenceLedger,
} from "../../platform/moduleCatalogue/moduleDeliveryEvidenceLedger.js";

/**
 * Read-only administrative planning catalogue. No client-supplied evidence
 * is accepted and no tenant configuration or entitlement is mutated.
 * Runtime acceptance remains unknown until independently verified.
 */
export function getAdministrativeModuleCatalogue({ includeCandidates = true } = {}) {
  const integrity = validateModuleCatalogueIntegrity();
  const allEntries = listModuleCatalogue({ includeCandidates: true });
  const evidenceIntegrity = validateModuleDeliveryEvidenceLedger(allEntries.map((entry) => entry.moduleId));
  const entries = (includeCandidates ? allEntries : listModuleCatalogue()).map((entry) => ({
    ...entry,
    status: inspectModuleCatalogueStatus(entry.moduleId),
    deliveryMilestones: inspectModuleDeliveryMilestones(entry.moduleId),
    deliveryEvidence: listVerifiedModuleDeliveryEvidence(entry.moduleId),
  }));
  return Object.freeze({
    readOnly: true,
    source: "AIIBP v3 requirement taxonomy (planning baseline)",
    statusEvidence: "reviewed GitHub source/CI snapshots only; runtime and production unverified",
    evidenceIntegrity,
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
