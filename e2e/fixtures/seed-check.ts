// ABOUTME: Baseline seed-data verifier run from global-setup. Fails the whole
// ABOUTME: E2E run with a specific message when required rows are missing so
// ABOUTME: individual tests never silently skip due to seed gaps.
//
// This runs before Playwright bootstraps sessions. Anon-visible rows are
// checked via PostgREST directly. For rows behind RLS (assignments,
// course_material_files, quizzes, notifications, certificates), each affected
// spec now uses `expect(count).toBeGreaterThan(0)` with a specific "Seed gap:"
// message — see e2e/journeys/{quiz-completion,profile-certificates,
// notifications,course-materials,grading-workflow}-flow.spec.ts. Those
// assertions are the primary loud-failure surface; this preflight is the
// fast-fail wrapper that catches the most common gaps up front.

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const COURSE_ID =
  process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const INSTRUCTOR_COURSE_ID =
  process.env.E2E_INSTRUCTOR_COURSE_ID || COURSE_ID;

type Check = {
  name: string;
  path: string;
  min: number;
  hint: string;
};

const CHECKS: Check[] = [
  {
    name: 'enrolled course exists',
    path: `courses?id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: `Reseed course ${COURSE_ID} (see e2e/fixtures/seed.sql).`,
  },
  {
    name: 'instructor course exists',
    path: `courses?id=eq.${INSTRUCTOR_COURSE_ID}&select=id`,
    min: 1,
    hint: `Reseed course ${INSTRUCTOR_COURSE_ID}.`,
  },
  {
    name: 'enrolled course has modules',
    path: `modules?course_id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: 'Seed at least one module under the enrolled course.',
  },
  // NOTE: We intentionally do NOT check lessons/assignments/quizzes/
  // course_material_files/certificates/notifications here — those tables are
  // protected by RLS and always return 0 rows to the anon key even when
  // properly seeded. Each of those categories is guarded by an
  // `expect(count).toBeGreaterThan(0, 'Seed gap: ...')` assertion inside its
  // owning journey spec, which fails loudly with a specific reseed hint.
];

async function head(path: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) {
    throw new Error(
      `[seed-check] Query failed for ${path}: ${res.status} ${await res.text()}`,
    );
  }
  await res.text();
  const range = res.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function verifySeedData(): Promise<void> {
  if (!ANON_KEY) {
    throw new Error(
      '[seed-check] VITE_SUPABASE_PUBLISHABLE_KEY is not set — cannot verify seed data.',
    );
  }

  // Resolve module IDs first so the lessons check can join through them.
  let modulesInList = '';
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/modules?course_id=eq.${COURSE_ID}&select=id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (r.ok) {
      const rows = (await r.json()) as Array<{ id: string }>;
      modulesInList = rows.map((m) => m.id).join(',');
    }
  } catch {
    // fall through — modules check will surface the failure
  }

  const failures: string[] = [];
  for (const c of CHECKS) {
    const path = c.path.replace('__MODULES__', modulesInList || 'none');
    if (c.path.includes('__MODULES__') && !modulesInList) {
      failures.push(
        `  ✗ ${c.name}: no modules found to search under. ${c.hint}`,
      );
      continue;
    }
    try {
      const n = await head(path);
      if (n < c.min) {
        failures.push(`  ✗ ${c.name}: found ${n}, need >= ${c.min}. ${c.hint}`);
      } else {
        console.log(`[seed-check] ✓ ${c.name} (${n})`);
      }
    } catch (err) {
      failures.push(`  ✗ ${c.name}: ${(err as Error).message}`);
    }
  }

  if (failures.length) {
    throw new Error(
      `\n[seed-check] Baseline seed data is missing — refusing to run E2E suite:\n${failures.join('\n')}\n\nRun: psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql\n`,
    );
  }
  console.log(
    '[seed-check] Baseline public seed data present. RLS-protected rows (assignments, quizzes, certificates, notifications, course_material_files) are validated by loud expect() assertions inside each journey spec.',
  );
}
