import {
  generateRebookingOpportunities,
} from "./rebookingOpportunityService.js";

function readQueryValue(
  request,
  key
) {
  const value =
    request.query?.[key];

  return Array.isArray(value)
    ? value[0]
    : value;
}

async function getRebookingOpportunities(
  request,
  response
) {
  const analytics =
    await generateRebookingOpportunities({
      lookbackDays:
        readQueryValue(
          request,
          "lookbackDays"
        ),
    });

  return response
    .status(200)
    .json({
      success: true,
      analytics,
    });
}

export {
  getRebookingOpportunities,
};