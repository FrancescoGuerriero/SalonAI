import { buildSystemObservabilityOverview } from "./systemObservabilityService.js";

export async function getSystemObservabilityOverview(request, response) {
  const businessId = String(request.effectiveAuthority?.businessId || "").trim();
  const verticalId = String(
    request.tenantContext?.businessType || request.tenantContext?.verticalId || ""
  )
    .trim()
    .toLowerCase();

  const overview = await buildSystemObservabilityOverview({ businessId, verticalId });

  response.json({
    success: true,
    observability: overview,
  });
}

export default { getSystemObservabilityOverview };
