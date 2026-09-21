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

  async get(id) {
    const { data } =
      await API.get(
        `${ENDPOINT}/${id}`
      );

    return data;
  },

  async getEmployeeRecord(recordId) {
    const { data } =
      await API.get(
        `/auth/admin/staff-record/${recordId}`
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

  async updateSettings(
    id,
    settings
  ) {
    const { data } =
      await API.patch(
        `${ENDPOINT}/${id}`,
        settings
      );

    return data;
  },

  async updateServices(
    id,
    services
  ) {
    const { data } =
      await API.patch(
        `${ENDPOINT}/${id}/services`,
        {
          services,
        }
      );

    return data;
  },

  async updateSchedule(
    id,
    workingHours
  ) {
    const { data } =
      await API.patch(
        `${ENDPOINT}/${id}/schedule`,
        {
          workingHours,
        }
      );

    return data;
  },
};

export default adminStaffService;
