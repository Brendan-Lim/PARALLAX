import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/browser-artifacts',
  timeout: 30000,
  fullyParallel: false,
  // One CI browser worker bounds profile, trace-copy and memory pressure on the local verifier.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    // Keep Playwright's per-launch temporary profile and per-test isolated contexts.
    // Never supply a personal userDataDir, credentials, cookies or storageState.
    launchOptions: {
      // Expose this test process's arguments for the isolation regression check.
      args: ['--use-mock-keychain', '--password-store=basic', '--enable-automation'],
    },
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }]],
});
