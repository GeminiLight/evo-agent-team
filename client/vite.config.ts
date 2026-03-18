/// <reference types="vitest/config" />
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
    ...(command === 'build' ? {
      build: {
        outDir: '../server/dist/public',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            manualChunks: {
              graph: ['@xyflow/react'],
              icons: ['lucide-react'],
            },
          },
        },
      },
    } : {}),
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/test/setup.ts',
      css: false,
      testTimeout: 10000,
      exclude: [
        '**/node_modules/**',
        // ChatView integration test requires >4GB heap due to heavy component tree;
        // run manually with NODE_OPTIONS="--max-old-space-size=8192" if needed.
        '**/ChatView.test.*',
      ],
    },
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
