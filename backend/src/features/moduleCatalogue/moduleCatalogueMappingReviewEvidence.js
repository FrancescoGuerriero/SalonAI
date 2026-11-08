import { getCapabilityPack } from "../../platform/capabilities/capabilityRegistry.js";

/**
 * Explicitly reviewed existing code boundaries for catalogue-only mapping review.
 * Feature-control keys and permission strings are NOT capability pack keys.
 * Candidates are suggestions for investigation, never persisted mappings.
 */
const REVIEWED = Object.freeze({
  "05": Object.freeze({
    sourcePath: "backend/src/features/commerce/commerceRoutes.js",
    observedFeatureGates: ["online-shop"],
    observedPermissions: ["product:read", "product:create", "order:read"],
    registeredPackCandidatesForReview: ["commerce"],
    boundary: "Existing online shop shares Commerce routes; verify whether Commerce already covers this requirement.",
  }),
  "15": Object.freeze({
    sourcePath: "backend/src/features/partnerMarketplace/partnerMarketplaceRoutes.js",
    observedFeatureGates: [],
    observedPermissions: ["feature-control:read", "feature-control:update"],
    registeredPackCandidatesForReview: [],
    boundary: "Existing partner-app marketplace is not an Amazon/eBay seller listing or fulfilment integration.",
  }),
  "21": Object.freeze({
    sourcePath: "backend/src/features/aiRecommendations/aiRecommendationRoutes.js",
    observedFeatureGates: ["ai-tools"],
    observedPermissions: ["ai:use"],
    registeredPackCandidatesForReview: ["ai"],
    boundary: "Existing Stylist Copilot shares the AI recommendation surface; review shared AI pack reuse and governed model contract.",
  }),
  "AI-CORE-04": Object.freeze({
    sourcePath: "backend/src/features/integrationPlatform/dataHubRoutes.js",
    observedFeatureGates: [],
    observedPermissions: ["ai:use", "feature-control:read"],
    registeredPackCandidatesForReview: ["ai"],
    boundary: "Existing AI Gateway evidence and evaluation APIs do not establish model costing, deployment or provider readiness.",
  }),
});
const frozen = (items) => Object.freeze([...items]);

export function inspectModuleMappingReviewEvidence(moduleId) {
  const reviewed = REVIEWED[String(moduleId)];
  if (!reviewed) {
    return Object.freeze({
      evidenceState: "not_reviewed",
      reviewedSourcePath: null,
      observedFeatureGates: frozen([]),
      observedPermissions: frozen([]),
      registeredPackCandidatesForReview: frozen([]),
      boundary: null,
      mappingApproved: false,
      productionAccepted: null,
    });
  }
  const candidates = reviewed.registeredPackCandidatesForReview.map((key) => getCapabilityPack(key).key);
  return Object.freeze({
    evidenceState: "source_boundary_reviewed",
    reviewedSourcePath: reviewed.sourcePath,
    observedFeatureGates: frozen(reviewed.observedFeatureGates),
    observedPermissions: frozen(reviewed.observedPermissions),
    registeredPackCandidatesForReview: frozen(candidates),
    boundary: reviewed.boundary,
    mappingApproved: false,
    productionAccepted: null,
  });
}
