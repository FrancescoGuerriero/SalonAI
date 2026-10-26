import {
  generateStylistCopilot,
} from "./aiStylistCopilotService.js";

export async function getAiStylistCopilot(request, response) {
  const tenantContext = request.tenantContext || {};
  const result = await generateStylistCopilot({
    appointmentId: request.params?.appointmentId,
    user: request.user,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"],
    businessId: tenantContext.businessId || null,
    locationId: tenantContext.locationId || null,
    allowedLocationIds: tenantContext.allowedLocationIds || [],
  });

  return response.status(200).json({
    success: true,
    ...result,
  });
}

export default { getAiStylistCopilot };
