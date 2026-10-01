import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // BACKEND_URL only tells the dev server where to forward /api requests.
  // The app code itself always calls relative /api URLs.
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      host: true, // expose on the local network so the phone can open it
      port: 5173,
      proxy: { '/api': backendUrl },
    },
    preview: {
      host: true,
      proxy: { '/api': backendUrl },
    },
  };
});
