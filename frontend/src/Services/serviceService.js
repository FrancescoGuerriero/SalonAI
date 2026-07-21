import API from "../api/axios.js";

const serviceService = {
  async getServices() {
    const { data } = await API.get(
      "/services"
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.services)) {
      return data.services;
    }

    return [];
  },

  async getServiceById(serviceId) {
    if (!serviceId) {
      throw new Error(
        "A service ID is required."
      );
    }

    const { data } = await API.get(
      `/services/${serviceId}`
    );

    return data;
  },

  async createService(serviceData) {
    const { data } = await API.post(
      "/services",
      serviceData
    );

    return data;
  },

  async updateService(
    serviceId,
    serviceData
  ) {
    if (!serviceId) {
      throw new Error(
        "A service ID is required."
      );
    }

    const { data } = await API.put(
      `/services/${serviceId}`,
      serviceData
    );

    return data;
  },

  async deleteService(serviceId) {
    if (!serviceId) {
      throw new Error(
        "A service ID is required."
      );
    }

    const { data } = await API.delete(
      `/services/${serviceId}`
    );

    return data;
  }
};

export default serviceService;