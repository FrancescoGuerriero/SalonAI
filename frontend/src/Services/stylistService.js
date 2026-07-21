import api from "./api";

const ENDPOINT = "/stylists";

const stylistService = {
  async getStylists(params = {}) {
    const { data } = await api.get(ENDPOINT, {
      params,
    });

    return data;
  },

  async getStylist(id) {
    const { data } = await api.get(
      `${ENDPOINT}/${id}`
    );

    return data;
  },

  async createStylist(stylist) {
    const { data } = await api.post(
      ENDPOINT,
      stylist
    );

    return data;
  },

  async updateStylist(id, stylist) {
    const { data } = await api.put(
      `${ENDPOINT}/${id}`,
      stylist
    );

    return data;
  },

  async deleteStylist(id) {
    const { data } = await api.delete(
      `${ENDPOINT}/${id}`
    );

    return data;
  },

  async toggleStatus(id) {
    const { data } = await api.patch(
      `${ENDPOINT}/${id}/status`
    );

    return data;
  },
};

export default stylistService;