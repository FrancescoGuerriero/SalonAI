/**
 * Dependency evidence is a read-only projection of trusted tenant records.
 * Manifest/subscription presence is not proof that a dependency operates
 * successfully or that it is safe to activate.
 */
function evidenceValue(records, field) {
  if (!records.length || records.some((record) => typeof record[field] !== "boolean")) {
    return null;
  }
  const values = new Set(records.map((record) => record[field]));
  return values.size === 1 ? records[0][field] : null;
}

export function inspectModuleDependencyEvidence(dependencyKeys = [], tenantEntries = []) {
  const dependencies = [...new Set(dependencyKeys)];
  return Object.freeze(dependencies.map((key) => {
    const matching = tenantEntries.filter((item) =>
      Array.isArray(item.capabilityPackKeys) && item.capabilityPackKeys.includes(key));
    const manifestSelected = evidenceValue(matching, "manifestSelected");
    const subscriptionEntitled = evidenceValue(matching, "subscriptionEntitled");
    const lifecycleValues = new Set(matching.map((row) => row.subscriptionStatus).filter(Boolean));
    const subscriptionStatus = lifecycleValues.size === 1 ? [...lifecycleValues][0] : null;
    const prerequisitesEvidenced = manifestSelected === true &&
      subscriptionEntitled === true &&
      ["active", "trial"].includes(subscriptionStatus);
    const confirmedBlocker = manifestSelected === false ||
      subscriptionEntitled === false ||
      (subscriptionStatus !== null && !["active", "trial"].includes(subscriptionStatus));
    return Object.freeze({
      capabilityKey: key,
      manifestSelected,
      subscriptionEntitled,
      subscriptionStatus,
      state: confirmedBlocker ? "confirmed_prerequisite_blocker"
        : prerequisitesEvidenced ? "prerequisites_evidenced" : "not_verified",
      operationallyAccepted: null,
      activationAuthorised: false,
    });
  }));
}
