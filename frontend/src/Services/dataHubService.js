import API from "../api/axios.js";

const ROOT = "/integration-platform/data-hub";

async function getCatalogue() {
  return (await API.get(`${ROOT}/catalogue`)).data;
}

async function getOverview() {
  return (await API.get(`${ROOT}/overview`)).data;
}

async function getFields() {
  return (await API.get(`${ROOT}/fields`)).data;
}

async function runQuery(payload) {
  return (await API.post(`${ROOT}/query`, payload)).data;
}

async function getAiEvidence(payload) {
  return (await API.post(`${ROOT}/ai-evidence`, payload)).data;
}

async function getAiGatewayEvidence(payload) {
  return (await API.post(`${ROOT}/ai-gateway/evidence`, payload)).data;
}

async function planAiGateway(payload) {
  return (await API.post(`${ROOT}/ai-gateway/plan`, payload)).data;
}

async function previewAiAdvisory(payload) {
  return (await API.post(`${ROOT}/ai-gateway/advisory-preview`, payload)).data;
}

async function listAiGatewayInvocations(params = {}) {
  const response = await API.get(`${ROOT}/ai-gateway/invocations`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

async function listAiCandidateEvaluations(params = {}) {
  const response = await API.get(`${ROOT}/ai-gateway/candidate-evaluations`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

async function getAiCandidateEvaluation(recordId) {
  return (await API.get(`${ROOT}/ai-gateway/candidate-evaluations/${encodeURIComponent(recordId)}`)).data;
}

async function reviewAiCandidateEvaluation(recordId, payload) {
  return (await API.patch(`${ROOT}/ai-gateway/candidate-evaluations/${encodeURIComponent(recordId)}/review`, payload)).data;
}

async function listAiPromotionProposals(params = {}) {
  const response = await API.get(`${ROOT}/ai-gateway/promotion-proposals`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

async function getAiPromotionProposal(dossierId) {
  return (await API.get(`${ROOT}/ai-gateway/promotion-proposals/${encodeURIComponent(dossierId)}`)).data;
}

async function createAiPromotionProposal(payload) {
  return (await API.post(`${ROOT}/ai-gateway/promotion-proposals`, payload)).data;
}

async function updateAiPromotionProposal(dossierId, payload) {
  return (await API.patch(`${ROOT}/ai-gateway/promotion-proposals/${encodeURIComponent(dossierId)}`, payload)).data;
}

async function listSavedViews(params = {}) {
  const response = await API.get(`${ROOT}/saved-views`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

async function createSavedView(payload) {
  return (await API.post(`${ROOT}/saved-views`, payload)).data;
}

async function updateSavedView(viewId, payload) {
  return (await API.patch(`${ROOT}/saved-views/${encodeURIComponent(viewId)}`, payload)).data;
}

async function runSavedView(viewId) {
  return (await API.post(`${ROOT}/saved-views/${encodeURIComponent(viewId)}/query`)).data;
}

async function listDestinations(params = {}) {
  const response = await API.get(`${ROOT}/destinations`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

async function createDestination(payload) {
  return (await API.post(`${ROOT}/destinations`, payload)).data;
}

async function updateDestination(taskId, payload) {
  return (await API.patch(`${ROOT}/destinations/${encodeURIComponent(taskId)}`, payload)).data;
}

async function previewDestination(taskId) {
  return (await API.post(`${ROOT}/destinations/${encodeURIComponent(taskId)}/preview`)).data;
}

async function listDestinationRuns(params = {}) {
  const response = await API.get(`${ROOT}/destination-runs`, { params });
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

export {
  createAiPromotionProposal,
  createDestination,
  createSavedView,
  getAiCandidateEvaluation,
  getAiEvidence,
  getAiGatewayEvidence,
  getAiPromotionProposal,
  getCatalogue,
  getFields,
  getOverview,
  listAiCandidateEvaluations,
  listAiGatewayInvocations,
  listAiPromotionProposals,
  listDestinationRuns,
  listDestinations,
  listSavedViews,
  planAiGateway,
  previewAiAdvisory,
  previewDestination,
  reviewAiCandidateEvaluation,
  runQuery,
  runSavedView,
  updateAiPromotionProposal,
  updateDestination,
  updateSavedView,
};

export default {
  createAiPromotionProposal,
  createDestination,
  createSavedView,
  getAiCandidateEvaluation,
  getAiEvidence,
  getAiGatewayEvidence,
  getAiPromotionProposal,
  getCatalogue,
  getFields,
  getOverview,
  listAiCandidateEvaluations,
  listAiGatewayInvocations,
  listAiPromotionProposals,
  listDestinationRuns,
  listDestinations,
  listSavedViews,
  planAiGateway,
  previewAiAdvisory,
  previewDestination,
  reviewAiCandidateEvaluation,
  runQuery,
  runSavedView,
  updateAiPromotionProposal,
  updateDestination,
  updateSavedView,
};
