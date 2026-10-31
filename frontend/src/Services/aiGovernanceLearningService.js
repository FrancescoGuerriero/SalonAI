import API from "../api/axios.js";

export async function getAiGovernanceLearningOverview() {
  const response = await API.get(
    "/system-administration/ai-governance-learning"
  );
  return response.data?.aiGovernanceLearning || null;
}

export default {
  getAiGovernanceLearningOverview,
};
