import axios from 'axios';

// In production (Vercel), VITE_API_URL is set to the Render server URL.
// In development, Vite's proxy handles /api → localhost:4000.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 60_000, // 60s — video uploads and FFmpeg can take time
  withCredentials: true,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eventify_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('eventify_token');
      // Only redirect if we're in the admin area
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
