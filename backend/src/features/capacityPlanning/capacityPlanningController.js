import { generateCapacityPlan } from "./capacityPlanningService.js";

async function getCapacityPlan(request, response) {
  const analytics = await generateCapacityPlan(request.query);
  return response.status(200).json({ success: true, analytics });
}

export { getCapacityPlan };
