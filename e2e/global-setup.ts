// ABOUTME: Playwright global setup. Signs each E2E role into Supabase and persists
// ABOUTME: a storageState per role. Also bootstraps instructor/member passwords via
// ABOUTME: the admin-users edge function when only admin credentials are supplied,
// ABOUTME: so a single admin credential is enough to run the full suite.
import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Bridge sandbox-preinstalled browsers to the versioned paths Playwright expects.
// No-op outside the Lovable sandbox; safe to call in CI.
try {
  const shim = path.join(process.cwd(), 'scripts/sandbox-playwright-shim.sh');
  if (fs.existsSync(shim)) execSync(`bash ${shim}`, { stdio: 'inherit' });
} catch {
  // ignore — real CI has browsers installed the normal way
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
const SESSIONS_DIR = path.join(process.cwd(), '.playwright-sessions');

const DEFAULT_EMAILS = {
  admin: 'e2e-admin@insightscollective.org',
  instructor: 'e2e-instructor@insightscollective.org',
  member: 'e2e-member@insightscollective.org',
} as const;

type Role = keyof typeof DEFAULT_EMAILS;

interface TestUser {
  email: string;
  password: string;
}

const SHARED_PASSWORD = process.env.E2E_TEST_PASSWORD || '';

const TEST_USERS: Record<Role, TestUser> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || DEFAULT_EMAILS.admin,
    password: process.env.E2E_ADMIN_PASSWORD || SHARED_PASSWORD,
  },
  instructor: {
    email: process.env.E2E_INSTRUCTOR_EMAIL || DEFAULT_EMAILS.instructor,
    password: process.env.E2E_INSTRUCTOR_PASSWORD || SHARED_PASSWORD,
  },
  member: {
    email: process.env.E2E_MEMBER_EMAIL || DEFAULT_EMAILS.member,
    password: process.env.E2E_MEMBER_PASSWORD || SHARED_PASSWORD,
  },
};

async function signInViaApi(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Cheap probe: can this account already sign in with the shared password? The
// probe session is revoked immediately (scope=local) so it does not accumulate
// a row per CI run.
async function passwordWorks(email: string, password: string): Promise<boolean> {
  try {
    const session = await signInViaApi(email, password);
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// Uses the admin-users edge function's setE2EPassword action, which is narrowly
// scoped to the three dedicated e2e-* accounts. Requires an admin JWT.
async function bootstrapPassword(adminToken: string, email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action: 'setE2EPassword', data: { email, password } }),
  });
  if (!res.ok) {
    console.warn(`[global-setup] setE2EPassword failed for ${email}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function saveSessionForRole(role: Role, creds: TestUser, baseURL: string): Promise<void> {
  if (!creds.email || !creds.password) {
    console.warn(
      `[global-setup] Skipping ${role}: no credentials (set E2E_${role.toUpperCase()}_PASSWORD or E2E_TEST_PASSWORD)`,
    );
    fs.writeFileSync(path.join(SESSIONS_DIR, `${role}.json`), JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const tokenData = await signInViaApi(creds.email, creds.password);

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
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      // Disable all onboarding spotlight tours across the suite so their
      // dimmed overlays never intercept clicks on elements under test.
      localStorage.setItem('e2e:disable-tours', '1');
    },
    { key: 'supabase.auth.token', value: sessionValue },
  );
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await context.storageState({ path: path.join(SESSIONS_DIR, `${role}.json`) });
  await browser.close();
  console.log(`[global-setup] Session saved for ${role} (${creds.email})`);
}

async function sweepLeakedSmokeCourses(): Promise<void> {
  // Pre-run safety net: even if a previous smoke run was killed before its
  // afterAll cleanup, orphan "Smoke Course …" rows are removed here BEFORE the
  // next suite runs so they never accumulate in the live catalog.
  const instructor = TEST_USERS.instructor;
  if (!instructor.email || !instructor.password) return;
  try {
    const session = await signInViaApi(instructor.email, instructor.password);
    const token = session.access_token;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    // Scope strictly by title prefix + this instructor's id — cannot touch real courses.
    const instructorId = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
    ).sub as string;
    const url = `${SUPABASE_URL}/rest/v1/courses?instructor_id=eq.${instructorId}&title=like.Smoke%20Course%20*&select=id`;
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ id: string }>;
    for (const row of rows) {
      const del = (p: string) =>
        fetch(`${SUPABASE_URL}/rest/v1/${p}`, { method: 'DELETE', headers }).catch(() => undefined);
      await del(`certificates?course_id=eq.${row.id}`);
      await del(`enrollments?course_id=eq.${row.id}`);
      await del(`assignments?course_id=eq.${row.id}`);
      await del(`content_items?course_id=eq.${row.id}`);
      await del(`modules?course_id=eq.${row.id}`);
      await del(`courses?id=eq.${row.id}`);
    }
    if (rows.length) {
      console.log(`[global-setup] Swept ${rows.length} leaked "Smoke Course" row(s) from prior runs.`);
    }
  } catch (err) {
    console.warn(`[global-setup] Leaked-course sweep skipped: ${(err as Error).message}`);
  }
}

async function sweepLeakedAnnouncementProbes(): Promise<void> {
  // Pre-run safety net for the messaging/notifications hardening spec. That
  // spec inserts a real course_announcements row to verify the notification
  // fan-out trigger, and the fan-out generates one notification per enrolled
  // user. RLS scopes notification DELETE to auth.uid()=user_id, so the spec
  // itself can only clean the announcement — the fan-out notifications need
  // service_role. We only run this sweep when SUPABASE_SERVICE_ROLE_KEY is
  // provided in the environment (CI/local opt-in); it's never bundled.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;
  try {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };
    const del = (p: string) =>
      fetch(`${SUPABASE_URL}/rest/v1/${p}`, { method: 'DELETE', headers }).catch(() => undefined);
    // Both filters are scoped strictly by the exact test title prefix. They
    // cannot match real announcements or notifications.
    await del(`notifications?title=like.New%20announcement:%20E2E%20hardening%20announcement%20*`);
    await del(`course_announcements?title=like.E2E%20hardening%20announcement%20*`);
    console.log('[global-setup] Swept any leaked "E2E hardening announcement" test probes.');
  } catch (err) {
    console.warn(`[global-setup] Announcement-probe sweep skipped: ${(err as Error).message}`);
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  // Verify baseline seed data BEFORE bootstrapping sessions. If the fixtures
  // are missing, the suite fails here loudly rather than skipping tests later.
  if (process.env.E2E_SKIP_SEED_CHECK !== '1') {
    const { verifySeedData } = await import('./fixtures/seed-check.js');
    await verifySeedData();
  }

  await sweepLeakedSmokeCourses();
  await sweepLeakedAnnouncementProbes();



  const baseURL =
    config.projects.find((p) => p.use?.baseURL)?.use?.baseURL || 'http://localhost:8080';

  // If admin credentials exist and a shared password is defined, bootstrap the
  // instructor/member accounts to that shared password so the entire suite runs
  // from a single admin credential (ideal for CI).
  const admin = TEST_USERS.admin;
  if (SHARED_PASSWORD && admin.email && admin.password) {
    try {
      const adminSession = await signInViaApi(admin.email, admin.password);
      for (const role of ['instructor', 'member'] as const) {
        const target = TEST_USERS[role];
        if (!target.email) continue;
        if (target.password === SHARED_PASSWORD) {
          // Only set the password if it is not already correct. Setting it
          // revokes every existing session for that account, and this suite
          // runs against a shared Supabase project — so an unconditional
          // bootstrap deletes the sessions of any run already in flight for
          // another branch. Those runs then fail scattered specs with
          // `session_not_found` on /auth/v1/user, or silently drop to the
          // anon role and hit `42501 permission denied`. Both look like
          // product bugs and are not.
          if (await passwordWorks(target.email, SHARED_PASSWORD)) {
            console.log(`[global-setup] Password already valid for ${role} (${target.email})`);
            continue;
          }
          const ok = await bootstrapPassword(adminSession.access_token, target.email, SHARED_PASSWORD);
          if (ok) console.log(`[global-setup] Bootstrapped password for ${role} (${target.email})`);
        }
      }
    } catch (err) {
      console.warn(`[global-setup] Admin bootstrap skipped: ${(err as Error).message}`);
    }
  }

  for (const role of ['admin', 'instructor', 'member'] as const) {
    try {
      await saveSessionForRole(role, TEST_USERS[role], baseURL);
    } catch (err) {
      console.warn(`[global-setup] Session for ${role} failed: ${(err as Error).message}`);
      fs.writeFileSync(path.join(SESSIONS_DIR, `${role}.json`), JSON.stringify({ cookies: [], origins: [] }));
    }
  }
}

export default globalSetup;
