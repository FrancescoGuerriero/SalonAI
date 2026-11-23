import { createServiceError } from "../../../shared/serviceError.js";
import { buildManagementBiSnapshot } from "../../analytics/managementBiService.js";
import { analyseManagementBiWithPython } from "../../analytics/managementBiPythonService.js";

/**
 * The legacy root endpoint assembled unscoped whole-database aggregates from
 * operational collections without authoritative Business ownership. It must
 * never return shared data in a multi-tenant application.
 *
 * Existing clients should migrate to GET /api/premium-analytics/management,
 * which uses effective business/location authority and canonical metrics.
 */
export async function getPremiumAnalytics() {
  throw createServiceError(
    "The legacy analytics response is retired. Use the tenant-scoped management BI endpoint.",
    410,
    { code: "PREMIUM_ANALYTICS_LEGACY_UNSCOPED_DISABLED" },
  );
}

export async function getManagementBi(req, res) {
  const snapshot = await buildManagementBiSnapshot({
    effectiveAuthority: req.effectiveAuthority,
    periodDays: req.query.periodDays,
    asOfDate: req.query.asOfDate || new Date(),
  });
  return res.status(200).json({ success: true, snapshot });
}

export async function getManagementPythonAnalysis(req, res) {
  const result = await analyseManagementBiWithPython({
    effectiveAuthority: req.effectiveAuthority,
    actor: req.user,
    periodDays: req.body?.periodDays ?? req.query.periodDays,
    asOfDate: req.body?.asOfDate ?? req.query.asOfDate ?? new Date(),
  });
  return res.status(200).json({ success: true, ...result });
}
