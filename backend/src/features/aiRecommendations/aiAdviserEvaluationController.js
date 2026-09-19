import {
  getAdviserEvaluation,
} from "./aiAdviserEvaluationService.js";

export async function getEvaluation(
  request,
  response
) {
  const evaluation =
    await getAdviserEvaluation({
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
  getEvaluation,
};
