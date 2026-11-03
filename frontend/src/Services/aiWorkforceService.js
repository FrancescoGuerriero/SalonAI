import API from "../api/axios.js";

const AI_RECEPTIONIST_KEY = "ai-receptionist";

function paramsWithReceptionist(overrides = {}) {
  return {
    agentKey: AI_RECEPTIONIST_KEY,
    limit: 50,
    ...overrides,
  };
}

export async function getAiWorkforceRegistry() {
  const response = await API.get("/ai/workforce/registry");
  return response.data;
}

export async function listAiReceptionistRuns(params = {}) {
  const response = await API.get("/ai/workforce/runs", {
    params: paramsWithReceptionist(params),
  });
  return response.data;
}

export async function listAiReceptionistProposals(params = {}) {
  const response = await API.get("/ai/workforce/proposals", {
    params: paramsWithReceptionist(params),
  });
  return response.data;
}

export async function listAiReceptionistOutcomes(params = {}) {
  const response = await API.get("/ai/workforce/outcomes", {
    params: paramsWithReceptionist(params),
  });
  return response.data;
}

export { AI_RECEPTIONIST_KEY };

export default {
  getAiWorkforceRegistry,
  listAiReceptionistOutcomes,
  listAiReceptionistProposals,
  listAiReceptionistRuns,
};
