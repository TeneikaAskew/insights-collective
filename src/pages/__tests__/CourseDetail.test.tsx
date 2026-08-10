import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeCourse, makeModule, makeSubmission, makeQuizSubmission } from '@/test/utils/course-fixtures';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import { addEnrolledCourse } from '@/utils/idUtils';
import CourseDetail from '@/pages/CourseDetail';

const { COURSE_ID, router } = vi.hoisted(() => ({
  COURSE_ID: '123e4567-e89b-12d3-a456-426614174000',
  router: {
    pathname: '/courses/123e4567-e89b-12d3-a456-426614174000',
    navigate: vi.fn(),
  },
}));

// The page reads useParams/useLocation; pin them so the component sees a fixed
// course id and a controllable "current section" without a full route setup.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: COURSE_ID }),
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: router.pathname, search: '', hash: '', state: null, key: 'test' }),
  };
});

// Spy on the localStorage enrollment helper so the enroll-failure regression
// can assert it is NOT called when the insert fails.
vi.mock('@/utils/idUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/idUtils')>();
  return {
    ...actual,
    addEnrolledCourse: vi.fn(),
    isEnrolledInCourse: vi.fn(() => false),
    isWishlistedCourse: vi.fn(() => false),
  };
});

// Layout / heavy children are out of scope for these page tests.
vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/course/EditCourseButton', () => ({ EditCourseButton: () => null }));
vi.mock('@/components/course/CourseCalendarSync', () => ({ CourseCalendarSync: () => null }));
vi.mock('@/components/course/CourseProgressTimeline', () => ({ CourseProgressTimeline: () => null }));
vi.mock('@/components/course/CourseModulesList', () => ({ CourseModulesList: () => null }));
vi.mock('@/components/course/canvas/CanvasAssignmentsList', () => ({ CanvasAssignmentsList: () => null }));
vi.mock('@/components/course/CourseContentPreview', () => ({ CourseContentPreview: () => null }));
vi.mock('@/components/course/LoginOverlayCard', () => ({ LoginOverlayCard: () => null }));

// Hooks with their own supabase traffic get stable, quiet mocks.
// (useForums is intentionally NOT mocked: the page no longer calls it — the
// orphaned call fired a dead query on every course view.)
vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: () => ({ canEdit: false, isAdmin: false, isInstructor: false }),
}));
vi.mock('@/hooks/useCourseProgress', () => ({ useCourseProgress: () => ({ data: { percent: 0 } }) }));
vi.mock('@/hooks/useCourseThread', () => ({
  useCourseThread: () => ({ openThread: vi.fn(), opening: false }),
}));

// ---------------------------------------------------------------------------
// Per-table supabase builder helper (same pattern as CourseList tests).
// ---------------------------------------------------------------------------
type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type TableHandlers = Partial<
  Record<'select' | 'insert' | 'update' | 'delete' | 'upsert', (...args: any[]) => QueryResult | Promise<QueryResult>>
>;

function makeTableBuilder(handlers: TableHandlers) {
  const builder: any = {};
  let result: Promise<any> = Promise.resolve({ data: null, error: null });
  (['select', 'insert', 'update', 'delete', 'upsert'] as const).forEach((verb) => {
    builder[verb] = vi.fn((...args: any[]) => {
      const handler = handlers[verb];
      if (handler) result = Promise.resolve(handler(...args));
      return builder;
    });
  });
  for (const m of ['eq', 'neq', 'in', 'is', 'order', 'limit', 'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match', 'range', 'contains', 'like', 'ilike']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => result);
  builder.maybeSingle = vi.fn(() => result);
  builder.then = (onFulfilled: any, onRejected: any) => result.then(onFulfilled, onRejected);
  return builder;
}

function mockTables(tables: Record<string, TableHandlers>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => makeTableBuilder(tables[table] ?? {})
  );
  return tables;
}

const courseRow = makeCourse({
  id: COURSE_ID,
  title: 'Intro to Data Analytics',
  category: 'Data',
  level: 'Beginner',
  instructor: { id: 'instructor-1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
});
const moduleRow = makeModule({ id: 'module-1', course_id: COURSE_ID, title: 'Foundations of Analytics', week: 1 });

function successTables(): Record<string, TableHandlers> {
  return {
    courses: { select: () => ({ data: courseRow, error: null }) },
    modules: { select: () => ({ data: [moduleRow], error: null }) },
    content_items: { select: () => ({ data: [], error: null }) },
    enrollments: {
      // The head/count aggregate succeeds; plain selects (enrollment check)
      // find no existing enrollment.
      select: (_cols?: string, opts?: { head?: boolean }) =>
        opts?.head ? { count: 7, data: null, error: null } : { data: null, error: null },
    },
    course_wishlists: { select: () => ({ data: null, error: null }) },
  };
}

const authedUser = { id: 'user-1', email: 'student@example.com', user_metadata: {} } as any;

describe('CourseDetail', () => {
  beforeEach(() => {
    router.pathname = `/courses/${COURSE_ID}`;
    router.navigate.mockClear();
    vi.mocked(addEnrolledCourse).mockClear();
    vi.mocked(useAuth).mockReturnValue(createMockAuthProvider() as any);
    mockTables(successTables());
  });

  it('shows the loading spinner while the course is being fetched', () => {
    mockTables({ courses: { select: () => new Promise<QueryResult>(() => {}) } });

    const { container } = render(<CourseDetail />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Intro to Data Analytics')).not.toBeInTheDocument();
  });

  it('renders the course title, modules, and real enrollment count on success', async () => {
    render(<CourseDetail />);

    const titles = await screen.findAllByText('Intro to Data Analytics');
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText('Foundations of Analytics')).toBeInTheDocument();
    // Count comes from the enrollments aggregate, not a hardcoded 0.
    expect(screen.getByText('7 students enrolled')).toBeInTheDocument();

    // Course has no artwork — never substitute a stock unsplash photo.
    expect(document.body.innerHTML).not.toContain('unsplash');
  });

  it('shows the error UI when the course query fails and retry refetches', async () => {
    const tables = mockTables({
      ...successTables(),
      courses: { select: () => ({ data: null, error: { message: 'course fetch failed' } }) },
    });

    render(<CourseDetail />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load course')).toBeInTheDocument();
    expect(screen.getByText('course fetch failed')).toBeInTheDocument();

    // Backend recovers; Retry must refetch and render the course.
    tables.courses = { select: () => ({ data: courseRow, error: null }) };
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect((await screen.findAllByText('Intro to Data Analytics')).length).toBeGreaterThan(0);
    expect(screen.queryByText('course fetch failed')).not.toBeInTheDocument();
  });

  it('still renders the course when the enrollment count cannot be read, and omits the count', async () => {
    // Replaces a test that pinned the opposite behavior. Course pages are
    // public and `anon` has no SELECT on `enrollments`, so throwing here
    // replaced the whole page with an error state for every signed-out
    // visitor. The original concern — never show a misleading "0 enrolled" —
    // is kept by omitting the line rather than rendering a zero.
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head
            ? { count: null, data: null, error: { code: '42501', message: 'permission denied for table enrollments' } }
            : { data: null, error: null },
      },
    });

    render(<CourseDetail />);

    expect((await screen.findAllByText('Intro to Data Analytics')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 students enrolled/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 enrolled/)).not.toBeInTheDocument();
  });

  it('does not mark the client as enrolled when the enrollment insert fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head ? { count: 7, data: null, error: null } : { data: null, error: null },
        insert: () => ({ data: null, error: { message: 'insert rejected by RLS' } }),
      },
    });

    render(<CourseDetail />);

    const enrollButton = await screen.findByRole('button', { name: /enroll for free/i });
    fireEvent.click(enrollButton);

    // Wait for the enroll attempt to settle back to the idle button state.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enroll for free/i })).toBeEnabled()
    );

    // The failed insert must NOT leave the client believing it is enrolled.
    expect(vi.mocked(addEnrolledCourse)).not.toHaveBeenCalled();
    expect(screen.queryByText('Continue learning')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enroll for free/i })).toBeInTheDocument();
  });

  it('marks the client enrolled only after the insert succeeds', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head ? { count: 7, data: null, error: null } : { data: null, error: null },
        insert: () => ({ data: null, error: null }),
      },
    });

    render(<CourseDetail />);

    fireEvent.click(await screen.findByRole('button', { name: /enroll for free/i }));

    await waitFor(() => expect(vi.mocked(addEnrolledCourse)).toHaveBeenCalledWith(COURSE_ID));
    // Enrolled home view replaces the enroll CTA.
    expect(await screen.findByText('Continue learning')).toBeInTheDocument();
  });

  it('shows an inline announcements error with retry while the rest of the page renders', async () => {
    router.pathname = `/courses/${COURSE_ID}/announcements`;
    const tables = mockTables({
      ...successTables(),
      course_announcements: {
        select: () => ({ data: null, error: { message: 'announcements table offline' } }),
      },
    });

    render(<CourseDetail />);

    // The page itself still renders (header + tab heading)...
    expect((await screen.findAllByText('Intro to Data Analytics')).length).toBeGreaterThan(0);
    expect(screen.getByText('Announcements')).toBeInTheDocument();
    // ...with an inline error for the announcements area only.
    expect(await screen.findByText('Failed to load announcements')).toBeInTheDocument();
    expect(screen.getByText('announcements table offline')).toBeInTheDocument();

    // Retry re-runs the announcements fetch.
    tables.course_announcements = {
      select: () => ({
        data: [{ id: 'ann-1', title: 'Welcome aboard', content: null, is_pinned: false, created_at: '2026-01-01T00:00:00Z', created_by: 'instructor-1' }],
        error: null,
      }),
    };
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Welcome aboard')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load announcements')).not.toBeInTheDocument();
  });

  it('REGRESSION: a failed roster query shows an error UI — never "No students enrolled yet."', async () => {
    router.pathname = `/courses/${COURSE_ID}/people`;
    const tables = mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head
            ? { count: 7, data: null, error: null }
            : { data: null, error: { message: 'enrollments offline' } },
      },
    });

    render(<CourseDetail />);

    expect(await screen.findByText('Failed to load students')).toBeInTheDocument();
    expect(screen.getByText('enrollments offline')).toBeInTheDocument();
    // The outage must not masquerade as an empty roster.
    expect(screen.queryByText('No students enrolled yet.')).not.toBeInTheDocument();

    // Backend recovers; retry loads the real roster.
    tables.enrollments = {
      select: (_cols?: string, opts?: { head?: boolean }) =>
        opts?.head
          ? { count: 1, data: null, error: null }
          : {
              data: [{ user_id: 'user-2', completion_status: 40, enrolled_at: '2026-01-05T00:00:00Z' }],
              error: null,
            },
    };
    tables.profiles = {
      select: () => ({
        data: [{ id: 'user-2', first_name: 'Grace', last_name: 'Hopper', avatar_url: null }],
        error: null,
      }),
    };
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load students')).not.toBeInTheDocument();
  });

  it('routes a failed profiles lookup into the same people error state (no blank-name roster)', async () => {
    router.pathname = `/courses/${COURSE_ID}/people`;
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head
            ? { count: 1, data: null, error: null }
            : {
                data: [{ user_id: 'user-2', completion_status: 0, enrolled_at: null }],
                error: null,
              },
      },
      profiles: { select: () => ({ data: null, error: { message: 'profiles offline' } }) },
    });

    render(<CourseDetail />);

    expect(await screen.findByText('Failed to load students')).toBeInTheDocument();
    expect(screen.getByText('profiles offline')).toBeInTheDocument();
    expect(screen.queryByTestId('course-people-list')).not.toBeInTheDocument();
    expect(screen.queryByText('No students enrolled yet.')).not.toBeInTheDocument();
  });

  it('renders the signed-in student\'s real graded work in the Grades tab', async () => {
    router.pathname = `/courses/${COURSE_ID}/grades`;
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      ...successTables(),
      assignments: {
        select: () => ({ data: [{ id: 'a1', title: 'Essay 1', points: 100 }], error: null }),
      },
      quizzes: {
        select: () => ({ data: [{ id: 'q1', title: 'Week 1 Quiz', points_possible: 10 }], error: null }),
      },
      assignment_submissions: {
        select: () => ({
          data: [
            makeSubmission({
              id: 'sub-graded',
              assignment_id: 'a1',
              user_id: 'user-1',
              grade: 88,
              graded_at: '2026-02-01T00:00:00Z',
              grader_comments: 'Solid analysis',
              workflow_state: 'graded',
            }),
            // Ungraded submission must NOT appear as a grade row.
            makeSubmission({ id: 'sub-pending', assignment_id: 'a1', user_id: 'user-1' }),
          ],
          error: null,
        }),
      },
      quiz_submissions: {
        select: () => ({
          data: [makeQuizSubmission({ quiz_id: 'q1', user_id: 'user-1', kept_score: 9, score: 9 })],
          error: null,
        }),
      },
    });

    render(<CourseDetail />);

    const list = await screen.findByTestId('course-grades-list');
    expect(list).toHaveTextContent('Essay 1');
    expect(list).toHaveTextContent('88 / 100');
    expect(list).toHaveTextContent('Solid analysis');
    expect(list).toHaveTextContent('Week 1 Quiz');
    expect(list).toHaveTextContent('9 / 10');
    // Exactly one assignment row + one quiz row — the ungraded submission is excluded.
    expect(list.children).toHaveLength(2);
    expect(screen.queryByText('Nothing has been graded yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No grades available yet.')).not.toBeInTheDocument();
  });

  it('shows the genuine empty state only when nothing has been graded', async () => {
    router.pathname = `/courses/${COURSE_ID}/grades`;
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      ...successTables(),
      assignments: { select: () => ({ data: [{ id: 'a1', title: 'Essay 1', points: 100 }], error: null }) },
      quizzes: { select: () => ({ data: [], error: null }) },
      assignment_submissions: { select: () => ({ data: [], error: null }) },
      quiz_submissions: { select: () => ({ data: [], error: null }) },
    });

    render(<CourseDetail />);

    expect(await screen.findByText('Nothing has been graded yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('course-grades-list')).not.toBeInTheDocument();
  });

  it('shows an error with retry — not the empty state — when the grades fetch fails', async () => {
    router.pathname = `/courses/${COURSE_ID}/grades`;
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    const tables = mockTables({
      ...successTables(),
      assignments: { select: () => ({ data: null, error: { message: 'assignments offline' } }) },
    });

    render(<CourseDetail />);

    expect(await screen.findByText('Failed to load grades')).toBeInTheDocument();
    expect(screen.getByText('assignments offline')).toBeInTheDocument();
    expect(screen.queryByText('Nothing has been graded yet.')).not.toBeInTheDocument();

    // Recovery via retry.
    tables.assignments = { select: () => ({ data: [], error: null }) };
    tables.quizzes = { select: () => ({ data: [], error: null }) };
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Nothing has been graded yet.')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load grades')).not.toBeInTheDocument();
  });

  it('does not show a definitive Enroll CTA when the enrollment check fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head
            ? { count: 7, data: null, error: null }
            : { data: null, error: { message: 'enrollment check failed' } },
      },
    });

    render(<CourseDetail />);

    expect(await screen.findByText("Couldn't verify enrollment")).toBeInTheDocument();
    expect(screen.getByText('enrollment check failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enroll for free/i })).not.toBeInTheDocument();
  });
});
