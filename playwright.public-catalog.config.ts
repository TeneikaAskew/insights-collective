// ABOUTME: Playwright config for the ANONYMOUS public-catalog acceptance (e2e/public-catalog). No globalSetup, no login, no
// ABOUTME: storageState, no webServer, headless; three viewports. Loopback-only targets are enforced at config load.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
// @ts-expect-error: plain ESM helper without type declarations
import { runGuards } from './scripts/public-catalog-fixture/guards.mjs';

// Marks this run as the lane's own config. The specs skip themselves without it, because main's playwright.config.ts
// (chromium-member, testDir ./e2e) would otherwise collect e2e/public-catalog with a signed-in session.
process.env.PUBLIC_ACCEPT_OWN_CONFIG = '1';

// Fail closed before any browser starts. PUBLIC_ACCEPT_LIST_ONLY=1 permits `--list` (no browser) for static review only.
if (process.env.PUBLIC_ACCEPT_LIST_ONLY !== '1') {
  const errors: string[] = runGuards(process.env);
  if (errors.length) throw new Error(`public-catalog guards refused:\n${errors.join('\n')}`);
}
const BASE_URL = process.env.PUBLIC_ACCEPT_BASE_URL || 'http://127.0.0.1:4173';

const common = {
  baseURL: BASE_URL,
  headless: true,
  storageState: { cookies: [], origins: [] },
  serviceWorkers: 'block' as const,
  trace: 'retain-on-failure' as const,
  screenshot: 'only-on-failure' as const,
  // Every non-loopback connection from the browser goes to a dead loopback proxy: nothing can leave the machine.
  launchOptions: {
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost,[::1]' },
    args: ['--disable-background-networking', '--disable-component-update', '--no-pings', '--disable-domain-reliability'],
    ...(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}),
  },
};

export default defineConfig({
  testDir: './e2e/public-catalog',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: process.env.PUBLIC_ACCEPT_REPORT || 'test-results/public-catalog.json' }]],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 834, height: 1112 }, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
