import API from "../api/axios.js";

function responseData(response) {
  return response.data?.data || response.data;
}

export async function getDailyClose(date) {
  const response = await API.get("/daily-close", {
    params: { date },
  });

  return responseData(response);
}

export async function getDailyCloseHistory(params = {}) {
  const response = await API.get("/daily-close/history", {
    params,
  });

  return responseData(response);
}

export async function saveDailyCloseDraft(payload) {
  const response = await API.put("/daily-close/draft", payload);

  return responseData(response);
}

export async function closeBusinessDay(payload) {
  const response = await API.post("/daily-close/close", payload);

  return responseData(response);
}

export async function reopenBusinessDay(payload) {
  const response = await API.post("/daily-close/reopen", payload);

  return responseData(response);
}

const dailyCloseApi = {
  close: closeBusinessDay,
  get: getDailyClose,
  history: getDailyCloseHistory,
  reopen: reopenBusinessDay,
  saveDraft: saveDailyCloseDraft,
};

export default dailyCloseApi;
