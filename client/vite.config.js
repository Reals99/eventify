import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Development server config
    server: {
      port: 5173,
      // Proxy /api to local server only when VITE_API_URL is not set
      // In production, axios uses VITE_API_URL directly
      proxy: !env.VITE_API_URL ? {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      } : undefined,
    },

    // Production build optimisations
    build: {
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor libs into a separate chunk for better caching
            vendor: ['react', 'react-dom', 'react-router-dom'],
            http:   ['axios'],
          },
        },
      },
    },

    // Ensure env vars are available in the bundle
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },
  };
});
