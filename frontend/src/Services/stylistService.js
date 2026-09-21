import API from "../api/axios.js";

const ENDPOINT = "/stylists";

const stylistService = {
  async getStylists(params = {}) {
    const { data } = await API.get(ENDPOINT, {
      params,
    });

    return data;
  },

  async getPublicTeam(config = {}) {
    const { data } = await API.get(
      `${ENDPOINT}/public`,
      config
    );

    return data;
  },

  async getBookingStylists(
    serviceId,
    config = {}
  ) {
    const { data } = await API.get(
      `${ENDPOINT}/booking`,
      {
        ...config,
        params: {
          ...config.params,
          service:
            serviceId ||
            undefined,
        },
      }
    );

    return data;
  },

  async getStylist(id) {
    const { data } = await API.get(
      `${ENDPOINT}/${id}`
    );

    return data;
  },

  async getMyProfile() {
    const { data } = await API.get(
      `${ENDPOINT}/me/profile`
    );

    return data;
  },

  async updateMyProfile(profile) {
    const { data } = await API.patch(
      `${ENDPOINT}/me/profile`,
      profile
    );

    return data;
  },

  async getAvailability(id, params = {}, config = {}) {
    const { data } = await API.get(
      `${ENDPOINT}/${id}/availability`,
      {
        ...config,
        params,
      }
    );

    return data;
  },

  async createStylist(stylist) {
    const { data } = await API.post(
      ENDPOINT,
      stylist
    );

    return data;
  },

  async updateStylist(id, stylist) {
    const { data } = await API.put(
      `${ENDPOINT}/${id}`,
      stylist
    );

    return data;
  },

  async deleteStylist(id) {
    const { data } = await API.delete(
      `${ENDPOINT}/${id}`
    );

    return data;
  },

  async toggleStatus(id) {
    const { data } = await API.patch(
      `${ENDPOINT}/${id}/status`
    );

    return data;
  },
};

export default stylistService;
