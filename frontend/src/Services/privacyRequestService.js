import API from "../api/axios.js";

const BASE_URL =
  "/privacy-requests";

export async function createMyPrivacyRequest(
  data
) {
  const response =
    await API.post(
      `${BASE_URL}/me`,
      data
    );
  return response.data;
}

export async function listMyPrivacyRequests() {
  const response =
    await API.get(
      `${BASE_URL}/me`
    );
  return response.data;
}

export async function listPrivacyRequests(
  params = {}
) {
  const response =
    await API.get(
      `${BASE_URL}/management`,
      {
        params,
      }
    );
  return response.data;
}

export async function updatePrivacyRequest(
  id,
  data
) {
  const response =
    await API.patch(
      `${BASE_URL}/management/${encodeURIComponent(id)}`,
      data
    );
  return response.data;
}

export default {
  createMyPrivacyRequest,
  listMyPrivacyRequests,
  listPrivacyRequests,
  updatePrivacyRequest,
};
