import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Provide DATABASE_URL for tests
      DATABASE_URL: process.env.DATABASE_URL || 'file:./test.db',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      RUNNER_API_KEY: 'test-runner-key',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
