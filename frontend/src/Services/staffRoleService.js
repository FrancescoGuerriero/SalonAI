import API from "../api/axios.js";

const ENDPOINT =
  "/staff-roles";

const staffRoleService = {
  async list() {
    const { data } =
      await API.get(
        ENDPOINT
      );

    return Array.isArray(
      data?.roles
    )
      ? data.roles
      : [];
  },

  async create(payload) {
    const { data } =
      await API.post(
        ENDPOINT,
        payload
      );

    return data;
  },

  async update(
    id,
    payload
  ) {
    const { data } =
      await API.patch(
        `${ENDPOINT}/${id}`,
        payload
      );

    return data;
  },

  async remove(id) {
    const { data } =
      await API.delete(
        `${ENDPOINT}/${id}`
      );

    return data;
  },
};

export default staffRoleService;
