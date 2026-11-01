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

// ---------------------------------------------------------------------------
// Catalog filter contract (unit-contract proof only; RLS and live data are not exercised here).
//
// The builder above ignores every filter (`eq` returns the same rows whatever it is given), so the tests above would
// pass with ANY filter, including the legacy `status = 'published'` one. Here the mock is query-aware: it applies each
// `.eq(column, value)` to the fixture rows, and any other filter method fails loudly. The fixtures make the two
// columns contradict each other, so only the canonical `published = true` filter renders exactly the right cards.
// ---------------------------------------------------------------------------
describe('CourseList catalog filter contract', () => {
  const FIXTURES = [
    makeCourse({ id: 'flag-only', title: 'Flag Published, Status Draft', published: true, status: 'draft' }),
    makeCourse({ id: 'status-only', title: 'Status Published, Flag Off', published: false, status: 'published' }),
    makeCourse({ id: 'both', title: 'Both Published', published: true, status: 'published' }),
    makeCourse({ id: 'neither', title: 'Neither Published', published: false, status: 'draft' }),
  ];
  const FILTERS = ['neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match', 'range', 'contains', 'like', 'ilike'];

  function queryAwareCourses(rows: Record<string, unknown>[]) {
    const log: { select: unknown[]; eq: [string, unknown][]; order: unknown[][]; other: string[] } = { select: [], eq: [], order: [], other: [] };
    (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table !== 'courses') return makeTableBuilder({});
      const b: any = {};
      b.select = vi.fn((cols: unknown) => (log.select.push(cols), b));
      b.eq = vi.fn((col: string, val: unknown) => (log.eq.push([col, val]), b));
      b.order = vi.fn((...a: unknown[]) => (log.order.push(a), b));
      for (const m of FILTERS) b[m] = vi.fn(() => { log.other.push(m); throw new Error(`unexpected filter ${m}() on courses`); });
      b.then = (ok: any, bad: any) =>
        Promise.resolve({ data: rows.filter((r) => log.eq.every(([c, v]) => r[c] === v)), error: null }).then(ok, bad);
      return b;
    });
    return log;
  }
  const cardTitles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim()).sort();

  it('applies exactly one filter, published = true, and renders exactly the flag-published cards', async () => {
    const log = queryAwareCourses(FIXTURES);
    render(<CourseList />);
    expect(await screen.findByText('Both Published')).toBeInTheDocument();
    expect(log.eq).toEqual([['published', true]]);
    expect(log.other).toEqual([]);
    expect(cardTitles()).toEqual(['Both Published', 'Flag Published, Status Draft']);
    // The legacy status mirror must not decide visibility in either direction.
    expect(screen.queryByText('Status Published, Flag Off')).not.toBeInTheDocument();
    expect(screen.queryByText('Neither Published')).not.toBeInTheDocument();
  });

  it('shows the empty state when no row has published = true, even if status says published', async () => {
    const log = queryAwareCourses(FIXTURES.filter((r) => (r as Record<string, unknown>).published !== true));
    render(<CourseList />);
    expect(await screen.findByText('No courses found')).toBeInTheDocument();
    expect(log.eq).toEqual([['published', true]]);
    expect(screen.queryByText('Status Published, Flag Off')).not.toBeInTheDocument();
  });
});
