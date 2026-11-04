// ABOUTME: CourseDetail (not-enrolled view) shows Estimated time from estimated_hours in the hero and the sidebar.
// ABOUTME: Legacy duration is never shown; missing/zero estimates render nothing. Mocks copied from CourseDetail.test.tsx.
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

describe('CourseDetail estimated time', () => {
  beforeEach(() => {
    router.pathname = `/courses/${COURSE_ID}`;
    vi.mocked(useAuth).mockReturnValue(createMockAuthProvider() as any);
  });

  function withCourse(extra: Record<string, unknown>) {
    mockTables({ ...successTables(), courses: { select: () => ({ data: { ...courseRow, ...extra }, error: null }) } });
  }

  it('shows the rounded estimate in the hero and the sidebar, never the legacy duration', async () => {
    withCourse({ estimated_hours: 4.25, duration: 157 });
    render(<CourseDetail />);
    await screen.findAllByText('Intro to Data Analytics');
    expect(document.body.textContent).not.toContain('157');
    expect(screen.getAllByText(/4\.3 hours$/)).toHaveLength(2);
  });

  it('labels both estimates "Estimated time" for screen readers (accessibility)', async () => {
    withCourse({ estimated_hours: 4.25 });
    render(<CourseDetail />);
    await screen.findAllByText('Intro to Data Analytics');
    const labels = screen.getAllByText('Estimated time:');
    expect(labels).toHaveLength(2);
    labels.forEach((el) => expect(el).toHaveClass('sr-only'));
  });

  it.each([
    [null, 8],
    [0, 0],
    [Number.NaN, 12],
  ])('estimated_hours=%s (duration=%s) renders no time line and no stray number', async (h, d) => {
    withCourse({ estimated_hours: h, duration: d });
    render(<CourseDetail />);
    await screen.findAllByText('Intro to Data Analytics');
    expect(screen.queryByText('Estimated time:')).not.toBeInTheDocument();
    expect(screen.queryByText(/\bhours?\b/)).not.toBeInTheDocument();
    // The old `{course.duration && ...}` rendered a bare "0" for duration 0 and the raw number otherwise.
    // Exactly where the legacy value used to render: as a bare child text node of the hero meta row and of the
    // sidebar facts list (`{course.duration && ...}` leaves a literal "0" there when duration is 0).
    const heroRow = document.querySelector('div.flex.flex-wrap.items-center.gap-6') as HTMLElement;
    const factsList = screen.getAllByText(/^\d+ modules$/).map((e) => e.closest("div.flex.items-center.gap-3")).find(Boolean)!.parentElement as HTMLElement;
    for (const row of [heroRow, factsList]) {
      expect(row).toBeTruthy();
      const bare = Array.from(row.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent!.trim());
      expect(bare).not.toContain(String(d));
      expect(row.textContent).not.toMatch(new RegExp(`(^|\\D)${d}(\\D|$)`));
    }
  });
});
