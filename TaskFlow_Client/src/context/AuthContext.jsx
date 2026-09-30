import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { clearAskPanelStorage } from "../components/knowledge/askPanelStorage";

// The session lives in an HttpOnly cookie set by the server; send it with every request.
// Nothing auth-related is kept in localStorage, so injected scripts cannot steal the session.
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verify the session cookie on mount
  useEffect(() => {
    // Clean up values stored by older versions of the app
    ["token", "user", "userName", "role"].forEach((key) => localStorage.removeItem(key));

    const verifyAuth = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/me`);
        setUser(res.data?.user || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.get(`${API_BASE_URL}/api/auth/logout`);
    } catch {}
    // Don't leave this user's AI conversation (which can include customer data) in the tab
    clearAskPanelStorage();
    setUser(null);
  };

  // Role comes only from the server's response, never from the email address
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isAgent = user?.role === "agent";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        isAgent,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
