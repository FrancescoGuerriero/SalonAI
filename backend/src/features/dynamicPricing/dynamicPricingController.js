import { generateDynamicPricingRecommendations } from "./dynamicPricingService.js";

async function getDynamicPricingRecommendations(request, response) {
  const analytics = await generateDynamicPricingRecommendations(request.query);
  return response.status(200).json({ success: true, analytics });
}

export { getDynamicPricingRecommendations };
