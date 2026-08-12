import API from "../api/axios.js";

const TOKEN_KEY =
  "salonai_token";
const USER_KEY =
  "salonai_user";
const LEGACY_TOKEN_KEY =
  "token";

class AuthService {
  async register(
    userData
  ) {
    const response =
      await API.post(
        "/auth/register",
        userData,
        {
          _skipAuthRefresh:
            true,
        }
      );

    return response.data;
  }

  async login(
    credentials
  ) {
    const response =
      await API.post(
        "/auth/login",
        credentials,
        {
          _skipAuthRefresh:
            true,
        }
      );

    const data =
      response.data;

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

    this.storeAccessToken(
      token
    );
    this.storeUser(
      user
    );

    return {
      token,
      user,
    };
  }

  async requestPasswordReset(
    email
  ) {
    const response =
      await API.post(
        "/auth/forgot-password",
        { email },
        {
          _skipAuthRefresh:
            true,
        }
      );

    return response.data;
  }

  async resetPassword(
    token,
    password
  ) {
    const response =
      await API.post(
        "/auth/reset-password",
        {
          token,
          password,
        },
        {
          _skipAuthRefresh:
            true,
        }
      );

    this.clearSession();

    return response.data;
  }

  async getAccount() {
    const response =
      await API.get(
        "/auth/me"
      );

    return response.data;
  }

  async updateAccount(
    payload
  ) {
    const response =
      await API.patch(
        "/auth/me",
        payload
      );
    const data =
      response.data;

    if (data.user) {
      this.storeUser(
        data.user
      );
    }

    return data;
  }

  async logout() {
    const logoutRequest =
      API.post(
        "/auth/logout",
        {},
        {
          _skipAuthRefresh:
            true,
        }
      ).catch(
        (error) => {
          console.warn(
            "Server logout request failed; the local session was still cleared.",
            error
          );
        }
      );

    this.clearSession();

    await logoutRequest;
  }

  storeAccessToken(
    token
  ) {
    if (token) {
      localStorage.setItem(
        TOKEN_KEY,
        token
      );
      localStorage.removeItem(
        LEGACY_TOKEN_KEY
      );
    } else {
      localStorage.removeItem(
        TOKEN_KEY
      );
      localStorage.removeItem(
        LEGACY_TOKEN_KEY
      );
    }
  }

  storeUser(
    user
  ) {
    if (user) {
      localStorage.setItem(
        USER_KEY,
        JSON.stringify(
          user
        )
      );
    } else {
      localStorage.removeItem(
        USER_KEY
      );
    }
  }

  clearSession() {
    localStorage.removeItem(
      TOKEN_KEY
    );
    localStorage.removeItem(
      USER_KEY
    );
    localStorage.removeItem(
      LEGACY_TOKEN_KEY
    );
  }

  getToken() {
    return (
      localStorage.getItem(
        TOKEN_KEY
      ) ||
      localStorage.getItem(
        LEGACY_TOKEN_KEY
      )
    );
  }

  getCurrentUser() {
    const storedUser =
      localStorage.getItem(
        USER_KEY
      );

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(
        storedUser
      );
    } catch (error) {
      console.error(
        "Invalid user data in local storage:",
        error
      );

      localStorage.removeItem(
        USER_KEY
      );

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
    const user =
      this.getCurrentUser();

    return (
      user?.role ===
      "admin"
    );
  }
}

export default new AuthService();
