import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../', 'PORT');
  const backendPort = env.PORT || '3006';

  return {
    plugins: [react(), tailwindcss()],
    // In build mode, output directly into server/dist/public so the server
    // can serve them without any extra copy step.
    ...(command === 'build' ? { build: { outDir: '../server/dist/public', emptyOutDir: true } } : {}),
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:${backendPort}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
