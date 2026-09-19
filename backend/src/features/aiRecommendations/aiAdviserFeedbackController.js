import {
  submitAdviserFeedback,
} from "./aiAdviserFeedbackService.js";

export async function submitFeedback(
  request,
  response
) {
  const result =
    await submitAdviserFeedback({
      inferenceId:
        request.params
          ?.inferenceId,
      rating:
        request.body
          ?.rating,
      comment:
        request.body
          ?.comment,
      user:
        request.user,
    });

  return response
    .status(200)
    .json({
      success: true,
      ...result,
    });
}

export default {
  submitFeedback,
};
