import {
  submitAdviserFeedback,
} from "./aiAdviserFeedbackService.js";

export async function submitFeedback(
  request,
  response
) {
  const tenantContext =
    request.tenantContext ||
    {};
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
      ...result,
    });
}

export default {
  submitFeedback,
};
