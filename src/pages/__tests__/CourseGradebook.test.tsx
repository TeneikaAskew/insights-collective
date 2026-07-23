// ABOUTME: Tests for the CourseGradebook page — loading, permission gating, real
// ABOUTME: grade/quiz-score rendering from submissions, error/empty states, and grade updates.
import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeSubmission, makeQuizSubmission, makeProfile } from '@/test/utils/course-fixtures';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import CourseGradebook, { applyBulkSubmissionGrades } from '../CourseGradebook';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: vi.fn(),
}));

// Capture the toast calls made by both the page and the Gradebook child.
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
  toast: toastMock,
}));

// Pass-through wrapper around the REAL Gradebook that also captures the props
// the page hands it, so tests can drive handlers with no UI entry point
// (onBulkGradeUpdate) directly against the real page implementation.
const { gradebookPropsRef } = vi.hoisted(() => ({
  gradebookPropsRef: { current: null as any },
}));
vi.mock('@/components/course/gradebook/Gradebook', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/components/course/gradebook/Gradebook')
  >();
  const React = await import('react');
  return {
    Gradebook: (props: any) => {
      gradebookPropsRef.current = props;
      return React.createElement(actual.Gradebook, props);
    },
  };
});

type TableResult = { data: unknown; error: { message: string; code?: string } | null };

// Chainable, awaitable per-table query builder. `updateResult` (optional) is
// resolved instead of `result` once .update() has been called, so a table can
// succeed on reads but fail on writes.
function tableBuilder(result: TableResult | 'pending', updateResult?: TableResult) {
  const builder: any = {};
  let wroteUpdate = false;
  for (const m of [
    'select', 'insert', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
    'order', 'limit', 'filter', 'match', 'contains',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.update = vi.fn(() => {
    wroteUpdate = true;
    return builder;
  });
  if (result === 'pending') {
    builder.single = vi.fn(() => new Promise(() => undefined));
    builder.maybeSingle = vi.fn(() => new Promise(() => undefined));
    builder.then = () => undefined;
  } else {
    const pick = () => (wroteUpdate && updateResult ? updateResult : result);
    builder.single = vi.fn(() =>
      Promise.resolve(pick()).then((r) => ({
        data: Array.isArray(r.data) ? r.data[0] ?? null : r.data,
        error: r.error,
      })),
    );
    builder.maybeSingle = builder.single;
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(pick()).then(onFulfilled, onRejected);
  }
  return builder;
}

// Wires per-table builders and returns them so tests can assert on calls.
function wireTables(tables: Record<string, any>) {
  const builders: Record<string, any> = {};
  // Call history accumulates across tests; start clean so per-test table
  // assertions (e.g. "never queries grades") reflect only this test.
  (mockSupabaseClient.from as Mock).mockClear();
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
    if (!builders[table]) {
      builders[table] = tables[table] ?? tableBuilder({ data: [], error: null });
    }
    return builders[table];
  });
  return builders;
}

function tablesQueried(): string[] {
  return (mockSupabaseClient.from as Mock).mock.calls.map((c) => c[0]);
}

const assignmentRow = {
  id: 'a1',
  course_id: 'course-1',
  title: 'Essay 1',
  points: 100,
  is_published: true,
  due_date: null,
};

const quizRow = {
  id: 'q1',
  title: 'Quiz 1',
  points_possible: 10,
  content_items: { course_id: 'course-1' },
};

function successTables() {
  return {
    enrollments: tableBuilder({ data: [{ user_id: 'student-1' }], error: null }),
    profiles: tableBuilder({
      data: [makeProfile({ id: 'student-1', first_name: 'Ada', last_name: 'Lovelace' })],
      error: null,
    }),
    assignments: tableBuilder({ data: [assignmentRow], error: null }),
    quizzes: tableBuilder({ data: [quizRow], error: null }),
    assignment_submissions: tableBuilder({
      data: [
        makeSubmission({
          id: 'sub-1',
          assignment_id: 'a1',
          user_id: 'student-1',
          grade: 90,
          workflow_state: 'graded',
          graded_at: '2026-01-12T00:00:00Z',
        }),
      ],
      error: null,
    }),
    quiz_submissions: tableBuilder({
      data: [
        makeQuizSubmission({
          id: 'qsub-1',
          quiz_id: 'q1',
          user_id: 'student-1',
          score: 8,
          kept_score: 8,
        }),
      ],
      error: null,
    }),
  };
}

describe('CourseGradebook', () => {
  beforeEach(() => {
    toastMock.mockClear();
    gradebookPropsRef.current = null;
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'instructor-1', email: 'teach@example.com' },
        isAuthenticated: true,
      }) as any,
    );
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true,
      isInstructor: true,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
  });

  it('shows a loading skeleton while data loads', () => {
    wireTables({ enrollments: tableBuilder('pending') });

    const { container } = render(<CourseGradebook />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Gradebook')).not.toBeInTheDocument();
  });

  it('denies access to users without edit permission', () => {
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: false,
      isInstructor: false,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
    wireTables({});

    render(<CourseGradebook />);

    expect(
      screen.getByText(/You don't have permission to view the gradebook/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Gradebook')).not.toBeInTheDocument();
  });

  it('renders real assignment grades and quiz scores from submissions', async () => {
    wireTables(successTables());

    const { container } = render(<CourseGradebook />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    // Assignment grade straight from assignment_submissions.grade
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
    // Quiz score straight from quiz_submissions.kept_score
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
    // Total: (90 + 8) / (100 + 10) — appears in the class-average card and the total column
    expect(screen.getAllByText('89.1%').length).toBeGreaterThan(0);
    expect(screen.getByText('98/110')).toBeInTheDocument();

    // Quiz cells are read-only: scores are recorded at submission time.
    const quizCell = container.querySelector(
      '[title="Quiz scores are recorded at submission time"]',
    );
    expect(quizCell).toBeInTheDocument();
    expect(quizCell).toHaveTextContent('8');

    // REGRESSION: everything comes from real tables — never the nonexistent grades table.
    expect(tablesQueried()).not.toContain('grades');
  });

  it('renders a distinct empty state when there are no students', async () => {
    wireTables({});

    render(<CourseGradebook />);

    expect(
      await screen.findByText('No students are enrolled in this course yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Gradebook')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the error state, not an empty gradebook, when a query fails', async () => {
    // REGRESSION: a failed fetch used to fall through to an empty grades stub.
    wireTables({
      enrollments: tableBuilder({
        data: null,
        error: { message: 'connection refused', code: 'PGRST000' },
      }),
    });

    render(<CourseGradebook />);

    expect(await screen.findByText('Failed to load the gradebook')).toBeInTheDocument();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Gradebook')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No students are enrolled in this course yet.'),
    ).not.toBeInTheDocument();
  });

  it('saves a grade to assignment_submissions with only real columns and toasts success', async () => {
    const builders = wireTables(successTables());

    render(<CourseGradebook />);

    // Enter edit mode on the assignment cell, change the grade, save.
    fireEvent.click(await screen.findByText('90'));
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '95' } });
    fireEvent.click(input.parentElement!.querySelector('button')!);

    await waitFor(() => {
      expect(builders.assignment_submissions.update).toHaveBeenCalledTimes(1);
    });

    const payload = builders.assignment_submissions.update.mock.calls[0][0];
    // REGRESSION: only columns that exist in the schema — no graded_by, no status.
    expect(Object.keys(payload).sort()).toEqual(['grade', 'graded_at', 'workflow_state']);
    expect(payload.grade).toBe(95);
    expect(payload.workflow_state).toBe('graded');
    expect(typeof payload.graded_at).toBe('string');
    expect(payload).not.toHaveProperty('graded_by');
    expect(payload).not.toHaveProperty('status');
    expect(builders.assignment_submissions.eq).toHaveBeenCalledWith('id', 'sub-1');

    // REGRESSION: the nonexistent grades table is never touched.
    expect(tablesQueried()).not.toContain('grades');

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Success' }),
      );
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('shows a destructive toast when the grade update fails', async () => {
    const tables = successTables();
    tables.assignment_submissions = tableBuilder(
      {
        data: [
          makeSubmission({
            id: 'sub-1',
            assignment_id: 'a1',
            user_id: 'student-1',
            grade: 90,
            workflow_state: 'graded',
          }),
        ],
        error: null,
      },
      // Reads succeed so the page renders; the write fails.
      { data: null, error: { message: 'permission denied', code: '42501' } },
    );
    const builders = wireTables(tables);

    render(<CourseGradebook />);

    fireEvent.click(await screen.findByText('90'));
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.click(input.parentElement!.querySelector('button')!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      );
    });
    expect(builders.assignment_submissions.update).toHaveBeenCalledTimes(1);
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' }),
    );
  });

  describe('bulk grade updates', () => {
    it('applies per-submission updates and collects failures honestly', async () => {
      const builder: any = { update: vi.fn(() => builder) };
      builder.eq = vi.fn((_col: string, id: string) =>
        Promise.resolve(
          id === 'sub-bad'
            ? { data: null, error: { message: 'row locked' } }
            : { data: null, error: null },
        ),
      );
      // Call history accumulates across tests in this file; start clean so the
      // table assertions below only see this test's queries.
      (mockSupabaseClient.from as Mock).mockClear();
      (mockSupabaseClient.from as Mock).mockImplementation(() => builder);

      const result = await applyBulkSubmissionGrades([
        { studentId: 's1', itemId: 'a1', itemType: 'assignment', grade: 10, submissionId: 'sub-ok' },
        { studentId: 's2', itemId: 'a1', itemType: 'assignment', grade: 5, submissionId: 'sub-bad' },
        { studentId: 's3', itemId: 'q1', itemType: 'quiz', grade: 7 },
      ]);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toHaveLength(2);
      expect(result.failed.map((f) => f.reason)).toEqual([
        'row locked',
        'Quiz scores are recorded at submission time and cannot be edited here.',
      ]);

      // Only real columns in every write, only against assignment_submissions.
      for (const call of builder.update.mock.calls) {
        expect(Object.keys(call[0]).sort()).toEqual(['grade', 'graded_at', 'workflow_state']);
      }
      expect(tablesQueried()).toEqual(
        Array(builder.update.mock.calls.length).fill('assignment_submissions'),
      );
      expect(tablesQueried()).not.toContain('grades');
    });

    it('reports partial failures honestly in the toast', async () => {
      const tables = successTables();
      tables.assignment_submissions = tableBuilder(
        {
          data: [
            makeSubmission({ id: 'sub-1', assignment_id: 'a1', user_id: 'student-1', grade: 90 }),
          ],
          error: null,
        },
        // Every write fails; one of the two updates below also has no submission.
        { data: null, error: { message: 'row locked' } },
      );
      wireTables(tables);

      render(<CourseGradebook />);
      await screen.findByText('Ada Lovelace');

      await act(async () => {
        await gradebookPropsRef.current.onBulkGradeUpdate([
          { studentId: 'student-1', itemId: 'a1', itemType: 'assignment', grade: 70 },
          { studentId: 'student-2', itemId: 'a1', itemType: 'assignment', grade: 60 },
        ]);
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: expect.stringContaining('Saved 0 of 2 grades. 2 failed'),
        }),
      );
      expect(toastMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Success' }),
      );
    });
  });
});
