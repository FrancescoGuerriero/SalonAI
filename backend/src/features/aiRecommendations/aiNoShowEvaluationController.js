import {
  getNoShowModelEvaluation,
} from "../aiPlatform/noShowEvaluationService.js";

export async function getAiNoShowEvaluation(
  request,
  response
) {
  const evaluation =
    await getNoShowModelEvaluation({
      periodDays:
        request.query
          ?.periodDays,
    });

  return response
    .status(200)
    .json({
      success: true,
      evaluation,
    });
}

export default {
  getAiNoShowEvaluation,
};
