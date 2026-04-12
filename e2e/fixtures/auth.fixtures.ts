import { test as base } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sessions are stored at project root, not relative to this fixture file
const SESSIONS_DIR = path.join(process.cwd(), '.playwright-sessions');

interface AuthFixtures {
  /** Page pre-authenticated as admin */
  adminPage: Page;
  /** Page pre-authenticated as instructor */
  instructorPage: Page;
  /** Page pre-authenticated as member */
  memberPage: Page;
}

/**
 * Extended Playwright test fixture that injects pre-authenticated pages
 * for each role. Sessions are created once in global-setup.ts.
 */
export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context: BrowserContext = await browser.newContext({
      storageState: path.join(SESSIONS_DIR, 'admin.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  instructorPage: async ({ browser }, use) => {
    const context: BrowserContext = await browser.newContext({
      storageState: path.join(SESSIONS_DIR, 'instructor.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  memberPage: async ({ browser }, use) => {
    const context: BrowserContext = await browser.newContext({
      storageState: path.join(SESSIONS_DIR, 'member.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
