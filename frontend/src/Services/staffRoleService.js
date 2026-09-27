import API from "../api/axios.js";

const ENDPOINT =
  "/staff-roles";

async function loadStaffRoles() {
  const { data } =
    await API.get(
      ENDPOINT
    );

  return {
    roles:
      Array.isArray(
        data?.roles
      )
        ? data.roles
        : [],
    permissionScopes:
      data?.permissionScopes &&
      typeof data.permissionScopes ===
        "object"
        ? data.permissionScopes
        : {},
    scopeLegend:
      Array.isArray(
        data?.scopeLegend
      )
        ? data.scopeLegend
        : [],
  };
}

const staffRoleService = {
  async list() {
    return (
      await loadStaffRoles()
    ).roles;
  },

  async listWithMetadata() {
    return loadStaffRoles();
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
