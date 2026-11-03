import {
  generateStylistCopilot,
} from "./aiStylistCopilotService.js";

export async function getAiStylistCopilot(request, response) {
  const executionContext = request.coreAiExecutionContext;
  const result = await generateStylistCopilot({
    appointmentId: request.params?.appointmentId,
    user: request.user,
    coreAiExecutionContext: executionContext,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"],
    businessId: executionContext?.businessId || null,
    locationId: executionContext?.locationId || null,
    allowedLocationIds: executionContext?.allowedLocationIds || [],
  });

  return response.status(200).json({
    success: true,
    ...result,
  });
}

export default { getAiStylistCopilot };
