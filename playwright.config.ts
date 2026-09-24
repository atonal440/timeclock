import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutable } from './scripts/chromium-path.mjs';

// Outside CI, fall back to a preinstalled Chromium (e.g. Claude Code on the
// web only ships Chromium) when Playwright's pinned build isn't installed.
// Firefox/WebKit projects need `npx playwright install` locally.
const executablePath = process.env.CI ? undefined : chromiumExecutable();
const chromiumLaunch = executablePath ? { launchOptions: { executablePath } } : {};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /* Never auto-open the HTML report: it starts a server that blocks the run. */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...chromiumLaunch } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    /* The app is mostly used on phones. */
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], ...chromiumLaunch } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
