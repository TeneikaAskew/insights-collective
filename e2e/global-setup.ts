import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
const SESSIONS_DIR = path.join(process.cwd(), '.playwright-sessions');

interface TestUser {
  email: string;
  password: string;
}

const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
  instructor: {
    email: process.env.E2E_INSTRUCTOR_EMAIL || '',
    password: process.env.E2E_INSTRUCTOR_PASSWORD || '',
  },
  member: {
    email: process.env.E2E_MEMBER_EMAIL || '',
    password: process.env.E2E_MEMBER_PASSWORD || '',
  },
};

async function signInViaApi(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed for ${email}: ${await res.text()}`);
  }
  return res.json();
}

async function saveSessionForRole(
  role: string,
  creds: TestUser,
  baseURL: string,
): Promise<void> {
  if (!creds.email || !creds.password) {
    console.warn(`[global-setup] Skipping ${role}: no credentials provided (set E2E_${role.toUpperCase()}_EMAIL / E2E_${role.toUpperCase()}_PASSWORD)`);
    // Write an empty storage state so projects don't fail trying to read the file
    const emptyState = { cookies: [], origins: [] };
    fs.writeFileSync(path.join(SESSIONS_DIR, `${role}.json`), JSON.stringify(emptyState));
    return;
  }

  const tokenData = await signInViaApi(creds.email, creds.password);

  // Supabase JS v2 stores the session as a flat Session object directly at storageKey.
  // Inject it via addInitScript so it exists in localStorage BEFORE the React app and
  // Supabase client initialize — otherwise the client boots, finds nothing, and clears
  // any value we write after the fact.
  const sessionValue = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: 'bearer',
    expires_in: tokenData.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    user: tokenData.user,
  });

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  const context = await browser.newContext();

  // Inject before any page script runs
  await context.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: 'supabase.auth.token', value: sessionValue },
  );

  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  const sessionPath = path.join(SESSIONS_DIR, `${role}.json`);
  await context.storageState({ path: sessionPath });
  await browser.close();
  console.log(`[global-setup] Session saved for ${role} (${creds.email})`);
}

async function globalSetup(config: FullConfig): Promise<void> {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  const baseURL =
    config.projects.find((p) => p.use?.baseURL)?.use?.baseURL ||
    'http://localhost:8080';

  // Save sessions for all three roles sequentially to avoid spawning
  // multiple Chromium processes simultaneously (causes OOM crashes in CI/codespace).
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    await saveSessionForRole(role, creds, baseURL);
  }
}

export default globalSetup;
