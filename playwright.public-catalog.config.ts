// ABOUTME: Playwright config for the ANONYMOUS public-catalog acceptance (e2e/public-catalog). No globalSetup, no login, no
// ABOUTME: storageState, no webServer, no traces. Helper pins and loopback guards are enforced at load, before any browser.
//
// Browser boundary: the qualified lesson-editor egress helpers, imported AS-IS and blob-pinned (helper-pins.mjs), never copied:
//   resolver rule MAP * 127.0.0.1:1 (EXCLUDE localhost, 127.0.0.1) + allowlist proxy with loopback forced through it
//   (`<-loopback>`, so other loopback ports are refused too) + context route/WebSocket filter + redirect/service-worker
//   observation. The allowlist is exactly the app origin and the API origin. There is no CDN or avatar exception.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
// @ts-expect-error: plain ESM helpers without type declarations
import { checkHelperPins } from './scripts/public-catalog-fixture/helper-pins.mjs';
// @ts-expect-error: plain ESM helpers without type declarations
import { runGuards } from './scripts/public-catalog-fixture/guards.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const refuse = (lines: string[]) => { throw new Error(`public-catalog config refused:\n${lines.map((l) => l.split(':')[0]).join('\n')}`); };

// 1. Pinned helpers first: absent or drifted helpers refuse before anything is imported from them.
const pinErrors: string[] = checkHelperPins(ROOT);
if (pinErrors.length) refuse(pinErrors);

// 2. LIST_ONLY permits `--list` (no browser, static review) and nothing else.
const LIST_ONLY = process.env.PUBLIC_ACCEPT_LIST_ONLY === '1';
if (process.env.PUBLIC_ACCEPT_LIST_ONLY !== undefined && !(LIST_ONLY && process.argv.includes('--list'))) refuse(['PUBLIC_CATALOG_E_LIST_ONLY: only with --list']);

// 3. Self-test weakenings of the shared egress helper are refused outright.
for (const k of ['LE_ALLOWED_ORIGINS', 'LE_EGRESS_CONTROL']) if (process.env[k] !== undefined) refuse([`PUBLIC_CATALOG_E_EGRESS_OVERRIDE: ${k}`]);

// 4. Guards (loopback targets, DSN, proof consumer). BLOCKED today: no reviewed proof producer.
if (!LIST_ONLY) { const e: string[] = runGuards(process.env); if (e.length) refuse(e); }

const BASE_URL = process.env.PUBLIC_ACCEPT_BASE_URL || 'http://127.0.0.1:4173';
const API_URL = process.env.PUBLIC_ACCEPT_API_URL || 'http://127.0.0.1:54321';
// The egress helper's allowlist is LE_APP_ORIGIN + LE_API_ORIGIN; map exactly the two loopback origins, nothing else.
process.env.LE_APP_ORIGIN = new URL(BASE_URL).origin;
process.env.LE_API_ORIGIN = new URL(API_URL).origin;
// Marks this run as the lane's own config. The specs skip themselves without it, because main's playwright.config.ts
// (chromium-member, testDir ./e2e) would otherwise collect e2e/public-catalog with a signed-in session.
process.env.PUBLIC_ACCEPT_OWN_CONFIG = '1';

const { chromiumExecutableOption } = await import('./e2e/support/chromium-executable');

const common = {
  baseURL: BASE_URL,
  headless: true,
  storageState: { cookies: [], origins: [] },
  serviceWorkers: 'block' as const,
  trace: 'off' as const,
  video: 'off' as const,
  screenshot: 'off' as const,
  launchOptions: {
    ...chromiumExecutableOption(),
    args: ['--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1', '--disable-background-networking', '--disable-component-update', '--no-pings', '--disable-domain-reliability'],
  },
};

export default defineConfig({
  testDir: './e2e/public-catalog',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  forbidOnly: true,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: process.env.PUBLIC_ACCEPT_REPORT || 'test-results/public-catalog.json' }]],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 834, height: 1112 }, hasTouch: true } },
    // 768x1024 (Tailwind `md` boundary): owns the tablet shot PC-catalog-tablet-768x1024. ACCEPTANCE GAP until a run passes it.
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
