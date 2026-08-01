import { generateExecutiveCommandCentre } from "./executiveCommandService.js";

async function getExecutiveCommandCentre(request, response) {
  const analytics = await generateExecutiveCommandCentre(request.query);
  return response.status(200).json({ success: true, analytics });
}

export { getExecutiveCommandCentre };
