import API from "../api/axios.js";

function encodeToken(token) {
  return encodeURIComponent(
    String(token || "").trim()
  );
}

export function getPublicMarketingPreferences(
  token
) {
  return API.get(
    `/marketing-preferences/${encodeToken(token)}`
  );
}

export function unsubscribePublicMarketing(
  token,
  channel
) {
  return API.post(
    `/marketing-preferences/${encodeToken(token)}/unsubscribe/${encodeURIComponent(channel)}`
  );
}

export default {
  getPublicMarketingPreferences,
  unsubscribePublicMarketing,
};
