import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/ui',
  testMatch: '**/*.e2e.ts',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true },
    },
  ],
  webServer: {
    command: 'npx next start -p 3003',
    url: 'http://127.0.0.1:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { PORT: '3003' },
  },
})
