import API from "../api/axios.js";

const BASE_URL = "/future/feedback-analytics";

async function getFeedbackAnalytics(params = {}) {
  const response = await API.get(BASE_URL, { params });
  return response.data;
}

async function createFeedback(payload) {
  const response = await API.post(BASE_URL, payload);
  return response.data;
}

async function resolveFeedback(feedbackId, resolved = true) {
  const response = await API.patch(`${BASE_URL}/${feedbackId}/resolve`, { resolved });
  return response.data;
}

export { createFeedback, getFeedbackAnalytics, resolveFeedback };
