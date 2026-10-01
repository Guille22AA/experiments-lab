import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // BACKEND_URL only tells the dev server where to forward /api requests.
  // The app code itself always calls relative /api URLs.
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || 'http://localhost:3001';
  // changeOrigin: false keeps the browser's Host header, so the backend can check
  // that changes come from the app itself (same origin).
  const proxy = { '/api': { target: backendUrl, changeOrigin: false } };

  return {
    plugins: [react()],
    server: {
      host: true, // expose on the local network so the phone can open it
      port: 5173,
      proxy,
    },
    preview: {
      host: true,
      proxy,
    },
  };
});
