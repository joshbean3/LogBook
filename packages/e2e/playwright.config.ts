import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end flows and the accessibility scan, at two phone widths.
 *
 * With E2E_BASE_URL set (for example http://localhost:5211) the tests use servers that are already running. Without it,
 * Playwright starts its own: the API on a new, empty database with sign-up open, and the web dev server in front of it.
 * The API's output goes to E2E_API_LOG (the password reset test reads the reset link the server logs when no mail
 * provider is set).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const API_PORT = Number(process.env.E2E_API_PORT ?? 8799);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5199);
const own = !process.env.E2E_BASE_URL;
if (own && !process.env.E2E_API_LOG) process.env.E2E_API_LOG = path.join(os.tmpdir(), `logbook-e2e-api-${API_PORT}.log`);
const db = path.join(os.tmpdir(), `logbook-e2e-${API_PORT}-${Date.now()}.db`);

const phone = (width: number) => ({
  viewport: { width, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'en-US',
  timezoneId: process.env.E2E_TZ ?? 'America/New_York',
});

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-390', use: phone(390) },
    { name: 'phone-320', use: phone(320) },
  ],
  webServer: own
    ? [
        {
          command: `pnpm --filter @logbook/api exec tsx src/index.ts > "${process.env.E2E_API_LOG}" 2>&1`,
          cwd: repo,
          url: `http://localhost:${API_PORT}/api/health`,
          env: { DATABASE_PATH: db, ALLOW_SIGNUP: '1', PORT: String(API_PORT), APP_URL: `http://localhost:${WEB_PORT}`, NODE_ENV: 'development' },
          timeout: 120_000,
          reuseExistingServer: false,
        },
        {
          command: `pnpm --filter @logbook/web exec vite --port ${WEB_PORT} --strictPort`,
          cwd: repo,
          url: `http://localhost:${WEB_PORT}/`,
          env: { API_PORT: String(API_PORT) },
          timeout: 120_000,
          reuseExistingServer: false,
        },
      ]
    : undefined,
});
