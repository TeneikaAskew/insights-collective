// ABOUTME: Playwright global teardown — cleans up ephemeral e2e artifacts (auth sessions,
// ABOUTME: local temp files) and scoped test rows the specs created during the run. This
// ABOUTME: file is intentionally conservative: it NEVER deletes real user data.
//
// SAFETY MODEL — read before editing
// ==================================
// This teardown must never touch production/real user data. It is guarded four ways:
//
// 1. Allow-list only. Deletion is scoped strictly to rows owned by the seeded test
//    accounts (`E2E_TEST_EMAIL`, `E2E_INSTRUCTOR_EMAIL`, `E2E_ADMIN_EMAIL`) OR rows
//    tagged with a well-known marker (`e2e_test:true` in a metadata jsonb column).
//    Rows owned by any other user id are ignored.
// 2. No cascading truncates. We never TRUNCATE, DROP, or DELETE without a WHERE clause.
// 3. No service_role in the browser bundle. Teardown uses `SUPABASE_SERVICE_ROLE_KEY`
//    ONLY when explicitly opted in via `E2E_ENABLE_DB_TEARDOWN=true`; without that env
//    var, teardown is a no-op for the database (session cleanup still runs).
// 4. Environment gate. `E2E_ALLOW_TEARDOWN_TARGET` must equal the Supabase project ref
//    in `VITE_SUPABASE_PROJECT_ID`; a mismatch aborts teardown loudly. This prevents
//    accidentally pointing CI at a production project.
//
// The intent: destructive DB teardown is off by default. Even when a developer opts
// in, deletion is filtered by `user_id IN (test users)`, matching the same accounts
// that ran the specs. Real users' certificates, submissions, and enrollments are
// untouched because their user_id is not in the allow list.

import * as fs from 'fs';
import * as path from 'path';

const TEARDOWN_ENABLED = process.env.E2E_ENABLE_DB_TEARDOWN === 'true';
const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID;
const ALLOW_TARGET = process.env.E2E_ALLOW_TEARDOWN_TARGET;

// Opt-out for workflow steps that must inspect the sessions AFTER the run.
// The visual-baseline regeneration job checks that every role actually
// authenticated before it commits the new PNGs — a baseline captured from a
// logged-out page would turn the check green on a lie. That check is a separate
// workflow step, so it runs after this teardown and used to find the directory
// already gone, reporting "no admin session" for sessions that had been fine.
// Keep this opt-in and CI-scoped: the directory holds live JWTs. It is
// gitignored and the runner is ephemeral, so retaining it for the rest of the
// job does not persist or publish anything.
const KEEP_SESSIONS = process.env.E2E_KEEP_SESSIONS === 'true';

async function cleanupSessions(): Promise<void> {
  const sessionsDir = path.join(process.cwd(), '.playwright-sessions');
  if (KEEP_SESSIONS) {
    console.log('[global-teardown] Keeping .playwright-sessions/ (E2E_KEEP_SESSIONS=true)');
    return;
  }
  if (process.env.CI && fs.existsSync(sessionsDir)) {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    console.log('[global-teardown] Cleaned up .playwright-sessions/');
  }
}

async function collectTestUserIds(): Promise<string[]> {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return [];
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const emails = [
    process.env.E2E_TEST_EMAIL,
    process.env.E2E_MEMBER_EMAIL,
    process.env.E2E_INSTRUCTOR_EMAIL,
    process.env.E2E_ADMIN_EMAIL,
  ].filter((e): e is string => !!e && e.length > 0);
  if (emails.length === 0) return [];

  // Look up ids via profiles (public.profiles.id === auth.users.id).
  const { data } = await admin.from('profiles').select('id').in(
    'id',
    await admin
      .from('auth.users' as any)
      .select('id')
      .in('email', emails)
      .then((r: any) => (r.data || []).map((u: any) => u.id)),
  );
  return (data || []).map((r: any) => r.id);
}

async function scopedDbTeardown(): Promise<void> {
  if (!TEARDOWN_ENABLED) {
    console.log('[global-teardown] DB teardown disabled (set E2E_ENABLE_DB_TEARDOWN=true to enable)');
    return;
  }
  if (!PROJECT_REF || !ALLOW_TARGET || PROJECT_REF !== ALLOW_TARGET) {
    console.warn(
      `[global-teardown] REFUSING DB teardown: E2E_ALLOW_TEARDOWN_TARGET (${ALLOW_TARGET ?? 'unset'}) ` +
        `does not match VITE_SUPABASE_PROJECT_ID (${PROJECT_REF ?? 'unset'}). ` +
        `Refusing to run destructive queries against an unconfirmed project.`,
    );
    return;
  }

  const userIds = await collectTestUserIds();
  if (userIds.length === 0) {
    console.log('[global-teardown] No seeded test user ids resolved — skipping DB teardown.');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Allow-listed tables: only rows the test users created during the run.
  // Every DELETE below is scoped by user_id IN (<test users>). Real users are safe.
  const scopedTables: Array<{ table: string; column: string }> = [
    { table: 'notifications', column: 'user_id' },
    { table: 'assignment_submissions', column: 'user_id' },
    { table: 'quiz_submissions', column: 'user_id' },
    { table: 'content_item_progressions', column: 'user_id' },
    // Certificates are intentionally preserved — they're proof of completion and
    // survive teardown by design. If a spec creates a throwaway certificate, tag
    // it with certificate_data->>'e2e_test' = 'true' and delete via that key.
  ];

  for (const { table, column } of scopedTables) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .in(column, userIds);
    if (error) {
      console.warn(`[global-teardown] ${table}: ${error.message}`);
    } else {
      console.log(`[global-teardown] ${table}: removed ${count ?? 0} test-owned rows`);
    }
  }
}

async function globalTeardown(): Promise<void> {
  await cleanupSessions();
  try {
    await scopedDbTeardown();
  } catch (err) {
    console.error('[global-teardown] scopedDbTeardown failed (non-fatal):', err);
  }
}

export default globalTeardown;
