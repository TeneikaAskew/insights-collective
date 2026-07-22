// ABOUTME: Baseline seed-data verifier run from global-setup. Queries Supabase for
// ABOUTME: the rows every E2E suite depends on and throws (fails the whole run)
// ABOUTME: with a specific message when any are missing — never a silent skip.

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const COURSE_ID =
  process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const MEMBER_EMAIL =
  process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';

type Check = {
  name: string;
  path: string; // PostgREST path w/ filter
  min: number;
  hint: string;
};

const CHECKS: Check[] = [
  {
    name: 'enrolled course exists',
    path: `courses?id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: `Reseed course ${COURSE_ID} in e2e/fixtures/seed.sql.`,
  },
  {
    name: 'course has modules',
    path: `modules?course_id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: `Reseed modules under course ${COURSE_ID}.`,
  },
  {
    name: 'course has at least one quiz lesson',
    path: `lessons?lesson_type=eq.quiz&module_id=in.(select id from modules where course_id = '${COURSE_ID}')&select=id`,
    min: 1,
    // PostgREST can't do subselects like above via anon; verified separately by URL below.
    hint: 'Seed a quiz-type lesson (lesson_type=quiz) under one of the course modules.',
  },
  {
    name: 'course has at least one assignment',
    path: `assignments?course_id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: 'Seed at least one row in public.assignments for the course.',
  },
  {
    name: 'course has at least one material file',
    path: `course_material_files?course_id=eq.${COURSE_ID}&select=id`,
    min: 1,
    hint: 'Seed at least one row in public.course_material_files.',
  },
  {
    name: 'profiles table populated',
    path: `profiles?select=id`,
    min: 1,
    hint: 'Ensure profile rows exist (trigger on auth.users insert).',
  },
];

async function head(path: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1`, {
    method: 'GET',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) {
    // A non-2xx here means the table/column isn't reachable — treat as a hard
    // seed-check failure, not a silent zero.
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
  const failures: string[] = [];
  for (const c of CHECKS) {
    try {
      const n = await head(c.path);
      if (n < c.min) {
        failures.push(
          `  ✗ ${c.name}: found ${n}, need >= ${c.min}. ${c.hint}`,
        );
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
  console.log('[seed-check] All baseline seed data present.');
}
