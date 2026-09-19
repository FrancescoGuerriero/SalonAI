import API from "../api/axios.js";

export const DEFAULT_NO_SHOW_PARAMETERS = {
  horizonDays:
    14,
  highRiskThreshold:
    0.65,
  mediumRiskThreshold:
    0.35,
  includeRecommendations:
    true,
};

export async function getAiNoShowPredictions(
  values = {}
) {
  const response =
    await API.get(
      "/ai/no-show-predictions",
      {
        params: {
          ...DEFAULT_NO_SHOW_PARAMETERS,
          ...values,
        },
      }
    );

  return (
    response?.data ||
    response
  );
}

export async function getAiNoShowEvaluation({
  periodDays = 90,
} = {}) {
  const response =
    await API.get(
      "/ai/no-show-evaluation",
      {
        params: {
          periodDays,
        },
      }
    );

  return (
    response?.data
      ?.evaluation ||
    response?.evaluation ||
    response?.data ||
    response
  );
}

export default {
  getAiNoShowEvaluation,
  getAiNoShowPredictions,
};
