import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

// Load .env so E2E_* credentials are available to global-setup and tests
loadDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const SESSIONS_DIR = path.join(__dirname, '.playwright-sessions');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : 2,
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['github'],
        ['list'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
      ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    // CI captures full diagnostics on any failure; local keeps the lighter defaults.
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  projects: [
    // Chromium — member role (most feature tests)
    {
      name: 'chromium-member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'member.json'),
      },
      testIgnore: [
        '**/admin/**',
        '**/auth/**',
        '**/landing/**',
        '**/visual/**',
        // Instructor-only specs — handled by chromium-instructor project
        '**/courses/course-builder.spec.ts',
        '**/courses/course-builder-verification.spec.ts',
        '**/courses/course-management.spec.ts',
        '**/courses/course-gradebook.spec.ts',
        '**/courses/course-rubrics.spec.ts',
        '**/courses/course-question-banks.spec.ts',
        '**/assignments/grading-interface.spec.ts',
        '**/journeys/grading-workflow-flow.spec.ts',
      ],
    },
    // Chromium — admin role
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'admin.json'),
      },
      testMatch: ['**/admin/**'],
    },
    // Chromium — instructor role (course builder, grading)
    {
      name: 'chromium-instructor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'instructor.json'),
      },
      testMatch: [
        '**/courses/course-builder.spec.ts',
        '**/courses/course-builder-verification.spec.ts',
        '**/courses/course-management.spec.ts',
        '**/courses/course-gradebook.spec.ts',
        '**/courses/course-rubrics.spec.ts',
        '**/courses/course-question-banks.spec.ts',
        '**/assignments/grading-interface.spec.ts',
        '**/journeys/grading-workflow-flow.spec.ts',
      ],
    },
    // Unauthenticated — auth flows, landing, public pages
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/auth/**',
        '**/landing/**',
        '**/legal/**',
        '**/portfolio/public-portfolio.spec.ts',
        '**/survey/**',
        '**/blog/**',
      ],
    },
    // Cross-browser smoke tests: Firefox + WebKit on critical paths
    // These use higher timeouts because Firefox/WebKit are substantially
    // slower than Chromium in this codespace environment.
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: path.join(SESSIONS_DIR, 'member.json'),
        navigationTimeout: 45_000,
        actionTimeout: 20_000,
      },
      timeout: 90_000,
      testMatch: [
        '**/dashboard/**',
        '**/courses/course-list.spec.ts',
      ],
    },
    // WebKit (Safari) is extremely slow in this codespace environment (>90s per test)
    // and is disabled until a faster runner is available.
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: path.join(SESSIONS_DIR, 'member.json'),
    //   },
    //   timeout: 150_000,
    //   testMatch: ['**/dashboard/**', '**/auth/login.spec.ts'],
    // },
    // Visual regression projects — one per role. Each targets only e2e/visual/**
    // and passes its role via metadata so the shared spec can filter routes.
    // Baselines live under e2e/visual/__screenshots__/<spec>/<project>/*.png.
    {
      name: 'visual-public',
      testMatch: ['**/visual/**'],
      metadata: { visualRole: 'public' },
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'visual-member',
      testMatch: ['**/visual/**'],
      metadata: { visualRole: 'member' },
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: path.join(SESSIONS_DIR, 'member.json'),
      },
    },
    {
      name: 'visual-admin',
      testMatch: ['**/visual/**'],
      metadata: { visualRole: 'admin' },
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: path.join(SESSIONS_DIR, 'admin.json'),
      },
    },
    {
      name: 'visual-instructor',
      testMatch: ['**/visual/**'],
      metadata: { visualRole: 'instructor' },
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: path.join(SESSIONS_DIR, 'instructor.json'),
      },
    },
  ],
});
