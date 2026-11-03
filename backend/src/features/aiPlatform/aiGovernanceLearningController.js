import {
  buildAiGovernanceLearningOverview,
} from "./aiGovernanceLearningService.js";

export async function getAiGovernanceLearningOverview(req, res) {
  const businessId = String(req.effectiveAuthority?.businessId || "").trim();
  const verticalId = String(
    req.tenantContext?.businessType ||
      req.tenantContext?.verticalId ||
      ""
  )
    .trim()
    .toLowerCase();

  const overview = await buildAiGovernanceLearningOverview({
    businessId,
    verticalId,
  });

  res.json({
    success: true,
    aiGovernanceLearning: overview,
  });
}

export default {
  getAiGovernanceLearningOverview,
};
