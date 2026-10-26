import { defineConfig, devices } from '@playwright/test';

// У CI застосунок піднімається через docker compose (див. .github/workflows/ci.yml), тому webServer не потрібен.
// Локально: BASE_URL=http://localhost:5173 npx playwright test
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'uk-UA',
  },
  projects: [
    { name: 'chromium', grepInvert: /@mobile/, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', grepInvert: /@mobile/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', grepInvert: /@mobile/, use: { ...devices['Desktop Safari'] } },
    { name: 'edge', grepInvert: /@mobile/, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, grep: /@mobile/ },
  ],
});
