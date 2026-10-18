import {
  getAdviserEvaluation,
} from "./aiAdviserEvaluationService.js";

export async function getEvaluation(
  request,
  response
) {
  const tenantContext =
    request.tenantContext ||
    {};
  const evaluation =
    await getAdviserEvaluation({
      periodDays:
        request.query
          ?.periodDays,
      businessId:
        tenantContext.businessId ||
        null,
      locationId:
        tenantContext.locationId ||
        null,
      locationAccessMode:
        tenantContext.locationAccessMode ||
        "selected",
      allowedLocationIds:
        tenantContext.allowedLocationIds ||
        [],
    });

  return response
    .status(200)
    .json({
      success: true,
      evaluation,
    });
}

export default {
  getEvaluation,
};
