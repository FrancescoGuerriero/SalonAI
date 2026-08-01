import API from "../api/axios.js";

const BASE_URL =
  "/future/rebooking-opportunities";

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
  );
}

async function getRebookingOpportunities({
  lookbackDays = 90,
} = {}) {
  const response =
    await API.get(
      BASE_URL,
      {
        params: {
          lookbackDays:
            clampInteger(
              lookbackDays,
              7,
              365,
              90
            ),
        },
      }
    );

  return response.data;
}

const rebookingOpportunityService = {
  getRebookingOpportunities,
};

export {
  getRebookingOpportunities,
};

export default rebookingOpportunityService;