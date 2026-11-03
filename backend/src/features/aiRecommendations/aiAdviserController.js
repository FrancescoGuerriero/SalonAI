import {
  askSalonAiAdviser,
} from "./aiAdviserService.js";

export async function askAdviser(
  request,
  response
) {
  const executionContext = request.coreAiExecutionContext;
  const toolDecision = request.coreAiToolDecision;
  const result =
    await askSalonAiAdviser({
      question:
        request.body
          ?.question,
      contextPath:
        request.body
          ?.contextPath,
      periodDays:
        Number(
          request.body
            ?.periodDays
        ) || 30,
      user:
        request.user,
      coreAiExecutionContext: executionContext,
      coreAiToolDecision: toolDecision,
      requestId:
        request.id ||
        request.requestId ||
        request.headers?.[
          "x-request-id"
        ],
      businessId: executionContext?.businessId || null,
      locationId: executionContext?.locationId || null,
      locationAccessMode: executionContext?.locationAccessMode || "selected",
      allowedLocationIds: executionContext?.allowedLocationIds || [],
    });

  return response
    .status(200)
    .json({
      success: true,
      ...result,
    });
}

export default {
  askAdviser,
};
