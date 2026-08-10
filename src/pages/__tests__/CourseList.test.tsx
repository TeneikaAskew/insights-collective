import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeCourse } from '@/test/utils/course-fixtures';
import CourseList from '@/pages/CourseList';

// Keep the page under test isolated from heavy layout chrome.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/courses/CourseOnboardingWalkthrough', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Per-table supabase builder helper. Each `from(table)` call returns a fresh
// chainable builder whose eventual (awaited / .single() / .maybeSingle())
// result comes from the handler registered for the verb that was invoked.
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

const courseA = makeCourse({
  id: 'course-a',
  title: 'Intro to Data Analytics',
  category: 'Data',
  instructor: { id: 'instructor-1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
});
const courseB = makeCourse({
  id: 'course-b',
  title: 'Advanced Spreadsheet Sorcery',
  category: 'Productivity',
  // Unknown instructor: the card must omit the instructor line, not fake one.
  instructor: null,
});

function successTables(): Record<string, TableHandlers> {
  return {
    courses: { select: () => ({ data: [courseA, courseB], error: null }) },
    enrollments: {
      select: () => ({ data: [{ course_id: 'course-a' }, { course_id: 'course-a' }], error: null }),
    },
  };
}

describe('CourseList', () => {
  beforeEach(() => {
    mockTables(successTables());
  });

  it('shows the loading skeleton while courses are being fetched', () => {
    // Never-resolving query keeps the page in its loading state.
    mockTables({ courses: { select: () => new Promise<QueryResult>(() => {}) } });

    const { container } = render(<CourseList />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Intro to Data Analytics')).not.toBeInTheDocument();
  });

  it('renders published course cards on success without any stock-photo fallback', async () => {
    render(<CourseList />);

    expect(await screen.findByText('Intro to Data Analytics')).toBeInTheDocument();
    expect(screen.getByText('Advanced Spreadsheet Sorcery')).toBeInTheDocument();

    // Real instructor name renders; the generic "Instructor" label never does.
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.queryByText(/^Instructor$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Instructor\b\s*·/)).not.toBeInTheDocument();

    // Fixtures have no image_url/thumbnail — no fabricated unsplash artwork.
    expect(document.body.innerHTML).not.toContain('unsplash');
  });

  it('omits the instructor line entirely when instructor and category are unknown', async () => {
    mockTables({
      ...successTables(),
      courses: {
        select: () => ({
          data: [makeCourse({ id: 'course-c', title: 'Mystery Course', category: null, instructor: null })],
          error: null,
        }),
      },
      enrollments: { select: () => ({ data: [], error: null }) },
    });

    render(<CourseList />);

    expect(await screen.findByText('Mystery Course')).toBeInTheDocument();
    expect(screen.queryByText('Instructor')).not.toBeInTheDocument();
  });

  it('shows the empty-state copy when there are no published courses', async () => {
    mockTables({ courses: { select: () => ({ data: [], error: null }) } });

    render(<CourseList />);

    expect(await screen.findByText('No courses found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search or filters/)).toBeInTheDocument();
  });

  it('surfaces a query failure as an error UI and refetches on retry', async () => {
    const tables = mockTables({
      courses: { select: () => ({ data: null, error: { message: 'database exploded' } }) },
    });

    render(<CourseList />);

    expect(await screen.findByText('database exploded')).toBeInTheDocument();
    expect(screen.queryByText('Intro to Data Analytics')).not.toBeInTheDocument();

    // Fix the backend, then retry — the page must refetch, not reload.
    Object.assign(tables, successTables());
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Intro to Data Analytics')).toBeInTheDocument();
    expect(screen.queryByText('database exploded')).not.toBeInTheDocument();
  });

  it('never queries enrollments — this page is public and anon has no access', async () => {
    // Replaces a test that pinned the opposite behavior: the catalog used to
    // scan `enrollments` for a count no card renders, and treat the failure as
    // fatal. `anon` has no SELECT on that table by design, so every signed-out
    // visitor got an error page instead of the catalog.
    render(<CourseList />);

    expect(await screen.findByText('Intro to Data Analytics')).toBeInTheDocument();

    const queried = (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(queried).not.toContain('enrollments');
  });

  it('still renders the catalog when the viewer cannot read enrollments', async () => {
    mockTables({
      ...successTables(),
      enrollments: { select: () => ({ data: null, error: { code: '42501', message: 'permission denied for table enrollments' } }) },
    });

    render(<CourseList />);

    expect(await screen.findByText('Intro to Data Analytics')).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('never renders the hardcoded unsplash thumbnail URL', async () => {
    render(<CourseList />);

    await screen.findByText('Intro to Data Analytics');
    await waitFor(() => {
      expect(document.body.innerHTML).not.toContain('images.unsplash.com');
    });
  });
});
