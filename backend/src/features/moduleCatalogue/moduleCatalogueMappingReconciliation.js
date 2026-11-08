/**
 * Reconcile source-observed modules with canonical capability mappings.
 * An existing route is not a new entitlement key, a proof of activation,
 * or evidence that the complete business module is implemented.
 */
const freeze = (items) => Object.freeze([...items]);

export function inspectModuleMappingReconciliation(entry, implementationReference = null) {
  if (!entry || typeof entry.moduleId !== "string" || !Array.isArray(entry.capabilityPackKeys)) {
    throw new TypeError("A canonical module catalogue entry is required.");
  }

  const taxonomyOnly = entry.taxonomyOnly === true;
  const mappedCapabilityPackKeys = freeze(entry.capabilityPackKeys);
  const existingSourceReviewed = implementationReference?.existingImplementationReview === true;
  const apiMounts = freeze(existingSourceReviewed
    ? implementationReference.apiMounts || [] : []);

  // Classification is descriptive and does NOT write to capabilityRegistry,
  // module manifests, subscription records or staff permission definitions.
  const reconciliationState = taxonomyOnly ? "taxonomy_only"
    : mappedCapabilityPackKeys.length && existingSourceReviewed
      ? "registered_mapping_and_existing_source"
      : mappedCapabilityPackKeys.length
        ? "registered_mapping_source_not_reviewed"
        : existingSourceReviewed
          ? "existing_source_without_canonical_mapping"
          : "mapping_and_source_review_required";

  return Object.freeze({
    moduleId: entry.moduleId,
    reconciliationState,
    sourceReviewState: existingSourceReviewed ? "existing_source_reviewed" : "source_not_reviewed",
    mappedCapabilityPackKeys,
    observedApiMounts: apiMounts,
    reviewAction: taxonomyOnly ? "retain_taxonomy_only"
      : mappedCapabilityPackKeys.length
        ? "verify_existing_entitlement_and_runtime_contract"
        : existingSourceReviewed
          ? "review_reuse_of_existing_capability_without_duplicate_registration"
          : "investigate_source_and_existing_capability_relationship",
    createsCapabilityPack: false,
    changesEntitlements: false,
    productionAccepted: null,
    activationAuthorised: false,
  });
}
