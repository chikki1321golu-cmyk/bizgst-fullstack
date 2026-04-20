/**
 * Auth Context
 * Provides user/business state and login/logout to entire app
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, businessAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading,  setLoading]  = useState(true); // true while checking stored token

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('bizgst_token');
    const stored = localStorage.getItem('bizgst_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
        // Fetch fresh business profile
        businessAPI.get()
          .then(r => setBusiness(r.data.data))
          .catch(() => {}) // Non-fatal — user may not have set up business yet
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('bizgst_token', token);
    localStorage.setItem('bizgst_user', JSON.stringify(userData));
    setUser(userData);
    // Fetch business profile after login
    businessAPI.get()
      .then(r => setBusiness(r.data.data))
      .catch(() => {});
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bizgst_token');
    localStorage.removeItem('bizgst_user');
    setUser(null);
    setBusiness(null);
  }, []);

  const refreshBusiness = useCallback(async () => {
    const r = await businessAPI.get();
    setBusiness(r.data.data);
    return r.data.data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout, refreshBusiness, setBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
