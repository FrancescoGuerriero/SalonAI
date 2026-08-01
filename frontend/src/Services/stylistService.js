import API from "../api/axios.js";

const ENDPOINT = "/stylists";

const stylistService = {
  async getStylists(params = {}) {
    const { data } = await API.get(ENDPOINT, {
      params,
    });

    return data;
  },

  async getStylist(id) {
    const { data } = await API.get(
      `${ENDPOINT}/${id}`
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