import API from "../api/axios";
import { storage } from "../utils/storage";

class AuthService {
  async login(credentials) {
    const { data } = await API.post("/auth/login", credentials);

    storage.setToken(data.token);

    if (data.user) {
      storage.setUser(data.user);
    }

    return data;
  }

  async register(payload) {
    const { data } = await API.post("/auth/register", payload);

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

  isAuthenticated() {
    return !!storage.getToken();
  }
}

export default new AuthService();