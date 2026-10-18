const SOURCE_REQUIREMENTS = Object.freeze({
  customers: Object.freeze({ business: true, location: false }),
  appointments: Object.freeze({ business: true, location: true }),
  customerContactLogs: Object.freeze({ business: true, location: false }),
  campaigns: Object.freeze({ business: true, location: false }),
  rebookingCampaigns: Object.freeze({ business: true, location: false }),
  inventoryItems: Object.freeze({ business: true, location: false }),
  customerFeedback: Object.freeze({ business: true, location: false }),
  exportAuditEvents: Object.freeze({ business: true, location: false }),
});

function nonNegative(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

export function buildReportExportOwnershipReadiness(raw = {}) {
  const sources = {};
  const blockers = [];
  let totalRecords = 0;
  let totalUnownedBusiness = 0;
  let totalMissingRequiredLocation = 0;

  for (const [name, requirements] of Object.entries(SOURCE_REQUIREMENTS)) {
    const input = raw?.[name] || {};
    const total = nonNegative(input.total);
    const unownedBusiness = nonNegative(input.unownedBusiness);
    const missingLocation = nonNegative(input.missingLocation);

    totalRecords += total;
    totalUnownedBusiness += unownedBusiness;
    if (requirements.location) totalMissingRequiredLocation += missingLocation;

    const sourceBlockers = [];
    if (requirements.business && unownedBusiness > 0) {
      sourceBlockers.push("unowned-business");
      blockers.push({ source: name, blocker: "unowned-business", count: unownedBusiness });
    }
    if (requirements.location && missingLocation > 0) {
      sourceBlockers.push("missing-required-location");
      blockers.push({ source: name, blocker: "missing-required-location", count: missingLocation });
    }

    sources[name] = Object.freeze({
      total,
      unownedBusiness,
      missingLocation,
      businessRequired: requirements.business,
      locationRequired: requirements.location,
      ready: sourceBlockers.length === 0,
      blockers: Object.freeze(sourceBlockers),
    });
  }

  return Object.freeze({
    readOnly: true,
    safeForScopedRuntime: blockers.length === 0,
    summary: Object.freeze({
      sourceCount: Object.keys(SOURCE_REQUIREMENTS).length,
      totalRecords,
      totalUnownedBusiness,
      totalMissingRequiredLocation,
      blockerCount: blockers.length,
    }),
    sources: Object.freeze(sources),
    blockers: Object.freeze(blockers),
    recordIdentifiersIncluded: false,
    writesPerformed: false,
  });
}

export { SOURCE_REQUIREMENTS };
