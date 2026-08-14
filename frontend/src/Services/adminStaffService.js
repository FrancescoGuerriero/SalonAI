import API from "../api/axios.js";

const ENDPOINT =
  "/auth/admin/staff";

const adminStaffService = {
  async list(params = {}) {
    const { data } =
      await API.get(
        ENDPOINT,
        {
          params,
        }
      );

    return data;
  },

  async create(payload) {
    const { data } =
      await API.post(
        ENDPOINT,
        payload
      );

    return data;
  },

  async setStatus(
    id,
    isActive
  ) {
    const { data } =
      await API.patch(
        `${ENDPOINT}/${id}/status`,
        {
          isActive,
        }
      );

    return data;
  },
};

export default adminStaffService;
