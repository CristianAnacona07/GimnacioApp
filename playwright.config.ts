import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the gym-aplication Angular app.
 *
 * Run with: npm run e2e
 *
 * NOTE: These specs require a running dev server at baseURL and browsers
 * installed via `npx playwright install chromium`. The `webServer` block
 * below is commented out so CI/local can control how the server is started.
 * Uncomment it to let Playwright boot `ng serve` automatically.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Uncomment to have Playwright start the Angular dev server automatically.
  // Requires the app to build/serve cleanly in the CI environment.
  //
  // webServer: {
  //   command: 'npm start',
  //   url: 'http://localhost:4200',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
