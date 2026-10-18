import {
  generateManagementCopilot,
} from "./aiManagementCopilotService.js";

export async function getAiManagementCopilot(
  request,
  response
) {
  const tenantContext =
    request.tenantContext ||
    {};
  const result =
    await generateManagementCopilot({
      asOfDate:
        request.query
          ?.asOfDate,
      periodDays:
        Number(
          request.query
            ?.periodDays
        ) || 30,
      includeActionPlan:
        request.query
          ?.includeActionPlan !==
        "false",
      requestId:
        request.id ||
        request.headers?.[
          "x-request-id"
        ],
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
      message:
        "AI management brief generated successfully.",
      ...result,
    });
}

export default {
  getAiManagementCopilot,
};
