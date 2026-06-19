import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // 1. BYPASS: Hardcode a fake admin user and set loading to false immediately
    const [admin, setAdmin] = useState({ id: '123456789012345678901234', name: 'Admin', role: 'superadmin' });
    const [loading, setLoading] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);

    useEffect(() => {
        /* // 2. BYPASS: Comment out the real authentication checks for now!
        // We don't want the app trying to ping the backend while we are testing.
        
        api.get('/auth/first-run')
          .then(({ data }) => setIsFirstRun(data.isFirstRun))
          .catch(() => {});
    
        const token = localStorage.getItem('eventify_token');
        if (!token) { setLoading(false); return; }
    
        api.get('/auth/me')
          .then(({ data }) => setAdmin(data.admin))
          .catch(() => localStorage.removeItem('eventify_token'))
          .finally(() => setLoading(false));
        */
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