import API from "../api/axios.js";

export function getPublicLegalIdentity() {
  return API.get("/legal/public");
}

export default {
  getPublicLegalIdentity,
};
