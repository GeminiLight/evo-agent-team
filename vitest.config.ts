import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'client/vite.config.ts',
      'server/vitest.config.ts',
    ],
  },
});
