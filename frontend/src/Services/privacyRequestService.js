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

export async function downloadMyPrivacyData() {
  const response =
    await API.get(
      `${BASE_URL}/me/export`,
      {
        responseType: "blob",
      }
    );

  const disposition =
    response.headers?.[
      "content-disposition"
    ] || "";
  const match =
    disposition.match(
      /filename="?([^";]+)"?/i
    );
  const filename =
    match?.[1] ||
    "salonai-personal-data.json";
  const url =
    URL.createObjectURL(
      response.data
    );
  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download =
    filename;
  document.body.appendChild(
    anchor
  );
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return {
    filename,
  };
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
  downloadMyPrivacyData,
  listMyPrivacyRequests,
  listPrivacyRequests,
  updatePrivacyRequest,
};
