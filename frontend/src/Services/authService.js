import API from "../api/axios.js";

const TOKEN_KEY = "salonai_token";
const USER_KEY = "salonai_user";

class AuthService {
  async register(userData) {
    const response = await API.post(
      "/auth/register",
      userData
    );

    return response.data;
  }

  async login(credentials) {
    const response = await API.post(
      "/auth/login",
      credentials
    );

    const data = response.data;

    const token =
      data.token ||
      data.accessToken ||
      data.jwt;

    const user =
      data.user ||
      data.account ||
      data.profile;

    if (!token) {
      throw new Error(
        "The login response did not include an authentication token."
      );
    }

    if (!user) {
      throw new Error(
        "The login response did not include the user."
      );
    }

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );

    return {
      token,
      user
    };
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  getCurrentUser() {
    const storedUser =
      localStorage.getItem(USER_KEY);

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser);
    } catch (error) {
      console.error(
        "Invalid user data in local storage:",
        error
      );

      localStorage.removeItem(USER_KEY);

      return null;
    }
  }

  isAuthenticated() {
    return Boolean(
      this.getToken() &&
      this.getCurrentUser()
    );
  }

  isAdmin() {
    const user = this.getCurrentUser();

    return user?.role === "admin";
  }
}

export default new AuthService();