import { generateManagementCopilotBrief } from "./managementCopilotService.js";

async function getManagementCopilotBrief(request, response) {
  const analytics = await generateManagementCopilotBrief(request.query);
  return response.status(200).json({ success: true, analytics });
}

export { getManagementCopilotBrief };
