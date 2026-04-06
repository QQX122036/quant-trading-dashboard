import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'e2e.test.ts',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },
});
