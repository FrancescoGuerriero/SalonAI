import API from "../api/axios.js";

function data(response) {
  return response.data;
}

const dataImportService = {
  preview: (payload) => API.post("/data-imports/preview", payload).then(data),
  commit: (payload) => API.post("/data-imports/commit", payload).then(data),
  history: (params = {}) => API.get("/data-imports/history", { params }).then(data),
};

export default dataImportService;
