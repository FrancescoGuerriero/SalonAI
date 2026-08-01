import {
  createCustomerAiSummary,
} from "./aiCustomerSummaryService.js";

function requestId(request) {
  return (
    request.headers["x-request-id"] ||
    request.headers["x-correlation-id"] ||
    undefined
  );
}

export async function generateCustomerSummary(
  request,
  response
) {
  const result = await createCustomerAiSummary(
    request.params.customerId,
    {
      actorRole: request.user?.role || "stylist",
      requestId: requestId(request),
      summaryStyle:
        request.query.style === "concise"
          ? "concise"
          : "detailed",
    }
  );

  return response.status(200).json({
    success: true,
    ...result,
  });
}

export default {
  generateCustomerSummary,
};
