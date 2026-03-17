import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // vitest runs TS directly, but source imports use .js extension (for ESM)
    // Remap .js to .ts so vitest can find the modules
    alias: [
      { find: /^(.*)\.js$/, replacement: '$1.ts' },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
