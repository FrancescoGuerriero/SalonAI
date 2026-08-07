import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  SESSION_EXPIRED_EVENT,
  TOKEN_REFRESHED_EVENT,
} from "../api/axios.js";
import authService from "../Services/authService.js";

export const AuthContext =
  createContext(null);

export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null);
  const [
    token,
    setToken,
  ] = useState(null);
  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let active =
      true;

    function handleSessionExpired() {
      if (!active) {
        return;
      }

      setToken(null);
      setUser(null);
    }

    function handleTokenRefreshed(
      event
    ) {
      if (!active) {
        return;
      }

      const nextToken =
        event.detail?.token ||
        authService.getToken();
      const nextUser =
        event.detail?.user;

      setToken(
        nextToken ||
          null
      );

      if (nextUser) {
        setUser(
          nextUser
        );
        authService.storeUser(
          nextUser
        );
      }
    }

    window.addEventListener(
      SESSION_EXPIRED_EVENT,
      handleSessionExpired
    );
    window.addEventListener(
      TOKEN_REFRESHED_EVENT,
      handleTokenRefreshed
    );

    async function restoreSession() {
      const storedToken =
        authService.getToken();
      const storedUser =
        authService.getCurrentUser();

      if (!active) {
        return;
      }

      setToken(
        storedToken
      );
      setUser(
        storedUser
      );

      if (!storedToken) {
        setLoading(
          false
        );
        return;
      }

      try {
        const response =
          await authService.getAccount();

        if (!active) {
          return;
        }

        const nextUser =
          response.user ||
          null;

        setToken(
          authService.getToken()
        );
        setUser(
          nextUser
        );
        authService.storeUser(
          nextUser
        );
      } catch (error) {
        if (!active) {
          return;
        }

        console.warn(
          "Stored SalonAI session could not be restored.",
          error
        );

        authService.clearSession();
        setToken(null);
        setUser(null);
      } finally {
        if (active) {
          setLoading(
            false
          );
        }
      }
    }

    restoreSession();

    return () => {
      active =
        false;

      window.removeEventListener(
        SESSION_EXPIRED_EVENT,
        handleSessionExpired
      );
      window.removeEventListener(
        TOKEN_REFRESHED_EVENT,
        handleTokenRefreshed
      );
    };
  }, []);

  const login =
    useCallback(
      async (
        credentials
      ) => {
        const response =
          await authService.login(
            credentials
          );

        setToken(
          response.token
        );
        setUser(
          response.user ??
            null
        );

        return response;
      },
      []
    );

  const register =
    useCallback(
      async (
        payload
      ) => {
        return authService.register(
          payload
        );
      },
      []
    );

  const logout =
    useCallback(
      () => {
        void authService.logout();

        setToken(null);
        setUser(null);
      },
      []
    );

  const refreshAccount =
    useCallback(
      async () => {
        const response =
          await authService.getAccount();
        const nextUser =
          response.user ??
          null;

        setUser(
          nextUser
        );
        setToken(
          authService.getToken()
        );
        authService.storeUser(
          nextUser
        );

        return nextUser;
      },
      []
    );

  const updateAccount =
    useCallback(
      async (
        payload
      ) => {
        const response =
          await authService.updateAccount(
            payload
          );

        setUser(
          response.user ??
            null
        );

        return response;
      },
      []
    );

  const value =
    useMemo(
      () => ({
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshAccount,
        updateAccount,
        isAuthenticated:
          Boolean(token),
      }),
      [
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshAccount,
        updateAccount,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}
