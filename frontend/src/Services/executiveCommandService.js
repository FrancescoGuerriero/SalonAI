import API from "../api/axios.js";

async function getExecutiveCommandCentre(params = {}) {
  const response = await API.get("/future/executive-command-centre", { params });
  return response.data;
}

export { getExecutiveCommandCentre };
