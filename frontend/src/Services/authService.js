import API from "../api/axios.js";
import { storage } from "../utils/storage.js";

class AuthService {
  async login(credentials) {
    const { data } = await API.post(
      "/auth/login",
      credentials
    );

    if (!data?.token) {
      throw new Error(
        "The server did not return an authentication token."
      );
    }

    storage.setToken(data.token);
    storage.setUser(data.user ?? null);

    return data;
  }

  async register(payload) {
    const { data } = await API.post(
      "/auth/register",
      payload
    );

    return data;
  }

  logout() {
    storage.clear();
  }

  getToken() {
    return storage.getToken();
  }

  getCurrentUser() {
    return storage.getUser();
  }
}

export default new AuthService();