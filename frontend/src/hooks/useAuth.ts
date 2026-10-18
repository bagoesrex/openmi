import { useState, useEffect, useCallback } from "react";
import { login as apiLogin } from "../lib/api";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("openmi_token"));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem("openmi_token"));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem("openmi_token", token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem("openmi_token");
      setIsAuthenticated(false);
    }
  }, [token]);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiLogin(password);
      setToken(res.token);
      return true;
    } catch (err: any) {
      setError(err?.message || "Invalid password");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("openmi_token");
  }, []);

  return {
    token,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
  };
}
