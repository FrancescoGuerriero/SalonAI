import API from "../api/axios.js";

const appointmentService = {
  async getMyAppointments() {
    const { data } = await API.get("/appointments");

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.appointments)) {
      return data.appointments;
    }

    return [];
  },

  async createAppointment(appointmentData) {
    const { data } = await API.post(
      "/appointments",
      appointmentData
    );

    return data;
  },

  async cancelAppointment(appointmentId) {
    if (!appointmentId) {
      throw new Error(
        "An appointment ID is required."
      );
    }

    const { data } = await API.delete(
      `/appointments/${appointmentId}`
    );

    return data;
  }
};

export default appointmentService;