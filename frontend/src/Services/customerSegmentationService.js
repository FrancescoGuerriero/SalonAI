import API from "../api/axios.js";

function removeEmptyParameters(parameters = {}) {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

class CustomerSegmentationService {
  async getDefinitions(settings = {}) {
    const response = await API.get(
      "/customer-segments/definitions",
      {
        params:
          removeEmptyParameters(settings),
      }
    );

    return response.data;
  }

  async getOverview(settings = {}) {
    const response = await API.get(
      "/customer-segments/overview",
      {
        params:
          removeEmptyParameters(settings),
      }
    );

    return response.data;
  }

  async getCustomers({
    segment = "all",
    search = "",
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortDirection = "desc",
    settings = {},
  } = {}) {
    const response = await API.get(
      "/customer-segments/customers",
      {
        params:
          removeEmptyParameters({
            segment,
            search,
            page,
            limit,
            sortBy,
            sortDirection,
            ...settings,
          }),
      }
    );

    return response.data;
  }
}

export default new CustomerSegmentationService();