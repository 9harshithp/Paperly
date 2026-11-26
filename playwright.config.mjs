import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
  webServer: {
    command: 'node serve.mjs',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
