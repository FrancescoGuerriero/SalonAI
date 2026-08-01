import {
  createHaircareRecommendation,
  getAiIntegrationStatus,
} from "./aiRecommendationService.js";

function requestId(request) {
  return (
    request.headers["x-request-id"] ||
    request.headers["x-correlation-id"] ||
    undefined
  );
}

export async function status(request, response) {
  const result = await getAiIntegrationStatus({
    requestId: requestId(request),
  });

  return response.status(200).json({
    success: true,
    ...result,
  });
}

export async function recommendHaircare(request, response) {
  const recommendation = await createHaircareRecommendation(
    request.body,
    {
      requestId: requestId(request),
    }
  );

  return response.status(200).json({
    success: true,
    recommendation,
  });
}

export default {
  recommendHaircare,
  status,
};
