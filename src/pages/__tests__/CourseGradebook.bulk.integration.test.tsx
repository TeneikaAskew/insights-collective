// ABOUTME: The CourseGradebook page's bulk grade handler against the isolated local stack: real queries, RLS, the
// ABOUTME: grade-pin trigger and readback. Skipped unless E2E_GRADEBOOK_DB=1; refuses any non-loopback target.
import { execFileSync } from 'node:child_process';
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor, act } from '@/test/utils/test-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import CourseGradebook from '../CourseGradebook';
import { assertLocalDsn } from '../../../scripts/local-db/assert-local-dsn.mjs';

/**
 * Bulk grading has no UI, so this drives the page's own onBulkGradeUpdate (captured from the props it hands the
 * real Gradebook) with a real Supabase client signed in as the fixture instructor. The page loads the course's
 * assignments from the database and resolves each entry's points from them, so what is under test is the page's
 * real denominator lookup, its unknown-assignment refusal, and the stored rows afterwards. Only the two UI hooks
 * are stubbed (who is signed in, and the edit gate); row-level security and pin_assignment_grade_columns are the
 * database's own. Rows come from the "acdc" block in e2e/fixtures/seed.sql (0005 to 0007, graded 5.00 on 10 pts).
 */
const ENABLED = process.env.E2E_GRADEBOOK_DB === '1';
const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001';
const ROW = {
  valid: { assignment: 'acdc2222-0000-0000-0000-000000000005', submission: 'acdc3333-0000-0000-0000-000000000005' },
  over: { assignment: 'acdc2222-0000-0000-0000-000000000006', submission: 'acdc3333-0000-0000-0000-000000000006' },
  unknown: { assignment: 'acdc2222-0000-0000-0000-000000000007', submission: 'acdc3333-0000-0000-0000-000000000007' },
};

const { realClient } = vi.hoisted(() => ({ realClient: { current: null as any, userId: '' } }));

vi.mock('@/integrations/supabase/client', async () => {
  if (process.env.E2E_GRADEBOOK_DB !== '1') {
    const { mockSupabaseClient } = await vi.importActual<typeof import('@/test/mocks/supabase')>('@/test/mocks/supabase');
    return { supabase: mockSupabaseClient };
  }
  const { classifyTarget } = await import('../../../scripts/e2e/assert-safe-target.mjs');
  const url = process.env.VITE_SUPABASE_URL ?? '';
  const target = classifyTarget(url);
  if (target.kind !== 'loopback') {
    throw new Error(`E2E_GRADEBOOK_DB=1 needs VITE_SUPABASE_URL on the loopback stack; got ${target.shown}`);
  }
  const { createClient } = await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  // src/test/setup.ts replaces global fetch with vi.fn(); this suite needs the real one it set aside.
  const realFetch = (globalThis as { __realFetch?: typeof fetch }).__realFetch;
  if (typeof realFetch !== 'function') throw new Error('E2E_GRADEBOOK_DB=1 needs the real fetch kept by src/test/setup.ts');
  const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: realFetch },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org',
    password: process.env.E2E_INSTRUCTOR_PASSWORD || process.env.E2E_TEST_PASSWORD || '',
  });
  if (error || !data.user) throw new Error(`fixture instructor sign-in failed: ${error?.message ?? 'no user'}`);
  realClient.current = client;
  realClient.userId = data.user.id;
  return { supabase: client };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ courseId: COURSE_ID }), useNavigate: () => vi.fn() };
});
vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
  toast: toastMock,
}));
const { gradebookPropsRef } = vi.hoisted(() => ({ gradebookPropsRef: { current: null as any } }));
vi.mock('@/components/course/gradebook/Gradebook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/course/gradebook/Gradebook')>();
  const R = await import('react');
  return {
    Gradebook: (props: any) => {
      gradebookPropsRef.current = props;
      return R.createElement(actual.Gradebook, props);
    },
  };
});

function readRow(submissionId: string) {
  const dsn = process.env.SUPABASE_DB_URL ?? '';
  const verdict = assertLocalDsn(dsn) as { ok: boolean; target?: string; reason?: string };
  if (!(verdict.ok && verdict.target === 'loopback')) {
    throw new Error(`SUPABASE_DB_URL must be the loopback stack (${verdict.reason ?? 'not loopback'})`);
  }
  const env = { ...process.env };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT']) delete env[k];
  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/);
  return execFileSync(
    'psql',
    [dsn, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
      `select coalesce(grade::text,'<null>')||'|'||workflow_state||'|'||coalesce(graded_at::text,'<null>')
         from public.assignment_submissions where id = '${submissionId}'`],
    { encoding: 'utf8', env },
  ).trim();
}

describe.skipIf(!ENABLED)('CourseGradebook bulk handler on the isolated stack', () => {
  beforeAll(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: { id: realClient.userId }, isAuthenticated: true }) as any,
    );
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true, isInstructor: true, isAdmin: false, loading: false, error: null,
    } as any);
  });

  it('writes the in-range entry, refuses out-of-range and unknown-assignment entries, and leaves those rows unchanged', async () => {
    const before = { over: readRow(ROW.over.submission), unknown: readRow(ROW.unknown.submission) };
    expect(before.over.split('|').slice(0, 2)).toEqual(['5.00', 'graded']);
    expect(before.unknown.split('|').slice(0, 2)).toEqual(['5.00', 'graded']);

    render(<CourseGradebook />);
    // The page has loaded this course's assignments and the member's submissions from the database.
    await waitFor(
      () => {
        const ids = (gradebookPropsRef.current?.assignments ?? []).map((a: any) => a.id);
        expect(ids).toEqual(expect.arrayContaining([ROW.valid.assignment, ROW.over.assignment]));
        const subs = (gradebookPropsRef.current?.submissions ?? []).map((s: any) => s.id);
        expect(subs).toEqual(expect.arrayContaining([ROW.valid.submission, ROW.over.submission]));
      },
      { timeout: 20000 },
    );

    await act(async () => {
      await gradebookPropsRef.current.onBulkGradeUpdate([
        // Caller-supplied pointsPossible is ignored: the page uses the assignment row's 10.
        { studentId: 'x', itemId: ROW.valid.assignment, itemType: 'assignment', grade: 9.5, pointsPossible: 1000, submissionId: ROW.valid.submission },
        { studentId: 'x', itemId: ROW.over.assignment, itemType: 'assignment', grade: 10.004, pointsPossible: 100, submissionId: ROW.over.submission },
        // An assignment the course does not have: no points to check against, so no write.
        { studentId: 'x', itemId: 'acdc2222-0000-0000-0000-000000000099', itemType: 'assignment', grade: 1, pointsPossible: 10, submissionId: ROW.unknown.submission },
      ]);
    });

    const valid = readRow(ROW.valid.submission).split('|');
    expect(valid.slice(0, 2)).toEqual(['9.50', 'graded']);
    expect(readRow(ROW.over.submission)).toBe(before.over);
    expect(readRow(ROW.unknown.submission)).toBe(before.unknown);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Partial failure',
        variant: 'destructive',
        description: expect.stringContaining('Saved 1 of 3 grades. 2 failed: Enter a value between 0 and 10.'),
      }),
    );
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
  }, 60000);
});
