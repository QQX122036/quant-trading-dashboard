import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'e2e*.test.ts',
  timeout: 60000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
