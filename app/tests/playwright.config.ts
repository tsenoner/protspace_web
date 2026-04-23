import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Playwright configuration for ProtSpace app e2e tests (product tour, etc.).
 *
 * Assumes the dev server is already running on port 8080.
 * Start it with: pnpm dev:app
 */
export default defineConfig({
  testDir: TEST_DIR,

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 1 : 0,

  workers: 1,

  reporter: 'list',

  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'product-tour',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /product-tour\.spec\.ts/,
    },
    {
      name: 'dataset-reload',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /dataset-reload\.spec\.ts/,
    },
    {
      name: 'numeric-binning',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /numeric-binning\.spec\.ts/,
    },
    {
      name: 'brush-selection',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /brush-selection\.spec\.ts/,
    },
    {
      name: 'url-view-state',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /url-view-state\.spec\.ts/,
    },
    {
      name: 'url-view-state-firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /url-view-state\.spec\.ts/,
    },
    {
      name: 'url-view-state-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /url-view-state\.spec\.ts/,
    },
    {
      name: 'export-studio',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /export-studio\.spec\.ts/,
    },
    {
      name: 'export-double-check',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /export-double-check\.spec\.ts/,
    },
    {
      name: 'export-inset-check',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /export-inset-check\.spec\.ts/,
    },
    {
      name: 'inset-debug',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /inset-debug\.spec\.ts/,
    },
    {
      name: 'visual-smoke',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /visual-smoke\.spec\.ts/,
    },
  ],

  outputDir: '../test-results/',
});
