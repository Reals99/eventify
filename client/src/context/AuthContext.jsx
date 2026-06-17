import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin,       setAdmin]       = useState(null);
  const [loading,     setLoading]     = useState(true);  // checking stored token
  const [isFirstRun,  setIsFirstRun]  = useState(false); // no admins exist yet

  useEffect(() => {
    // Check first-run state (no auth needed)
    api.get('/auth/first-run')
      .then(({ data }) => setIsFirstRun(data.isFirstRun))
      .catch(() => {});

    // Verify stored token
    const token = localStorage.getItem('eventify_token');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then(({ data }) => setAdmin(data.admin))
      .catch(() => localStorage.removeItem('eventify_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('eventify_token', data.token);
    setAdmin(data.admin);
    setIsFirstRun(false);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('eventify_token');
    setAdmin(null);
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('eventify_token', data.token);
    setAdmin(data.admin);
    setIsFirstRun(false);
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, isFirstRun, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
