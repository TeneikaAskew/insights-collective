import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeCourse, makeModule } from '@/test/utils/course-fixtures';
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
vi.mock('@/hooks/useForums', () => ({ useForums: () => ({ forums: [], isLoadingForums: false }) }));
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

  it('treats a failed enrollment-count query as a page-level fetch failure', async () => {
    mockTables({
      ...successTables(),
      enrollments: {
        select: (_cols?: string, opts?: { head?: boolean }) =>
          opts?.head
            ? { count: null, data: null, error: { message: 'count unavailable' } }
            : { data: null, error: null },
      },
    });

    render(<CourseDetail />);

    expect(await screen.findByText('count unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0 students enrolled')).not.toBeInTheDocument();
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
