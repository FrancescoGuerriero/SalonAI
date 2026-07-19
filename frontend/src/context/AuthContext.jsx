import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import authService from "../services/authService.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = authService.getToken();
    const storedUser = authService.getCurrentUser();

    setToken(storedToken);
    setUser(storedUser);
    setLoading(false);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);

    setToken(response.token);
    setUser(response.user ?? null);

    return response;
  }, []);

  const register = useCallback(async (payload) => {
    return authService.register(payload);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAuthenticated: Boolean(token)
    }),
    [user, token, loading, login, register, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}