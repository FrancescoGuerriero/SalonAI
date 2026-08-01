import { generateMarketingAttribution } from "./marketingAttributionService.js";

async function getMarketingAttribution(request, response) {
  const analytics = await generateMarketingAttribution({
    months: request.query?.months,
  });

  return response.status(200).json({ success: true, analytics });
}

export { getMarketingAttribution };
