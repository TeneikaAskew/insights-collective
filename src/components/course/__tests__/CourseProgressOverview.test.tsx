// ABOUTME: Tests for CourseProgressOverview — real average grade derived from
// ABOUTME: assignment_submissions, distinct error UI, and no reads of the nonexistent grades table.
import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { CourseProgressOverview } from '../CourseProgressOverview';

vi.mock('@/hooks/useCourseProgress', () => ({
  useCourseProgress: vi.fn(),
}));

// ModuleProgressCard has its own data fetching; out of scope here.
vi.mock('../ModuleProgressCard', () => ({
  ModuleProgressCard: () => null,
}));

type TableResult = { data: unknown; error: { message: string; code?: string } | null };

function tableBuilder(result: TableResult) {
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
    'order', 'limit', 'filter', 'match', 'contains',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
  builder.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: result.error });
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function mockTables(tables: Record<string, TableResult>) {
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) =>
    tableBuilder(tables[table] ?? { data: [], error: null }),
  );
}

function tablesQueried(): string[] {
  return (mockSupabaseClient.from as Mock).mock.calls.map((c) => c[0]);
}

const courseRow = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  modules: [
    {
      id: 'm1',
      title: 'Module 1',
      description: 'First module',
      order_index: 1,
      unlock_at: null,
      prerequisites_met: true,
    },
  ],
};

function setProgressHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useCourseProgress).mockReturnValue({
    data: {
      modules: [{ moduleId: 'm1', totalItems: 2, completedItems: 1, percent: 50, isComplete: false }],
      totalItems: 2,
      completedItems: 1,
      percent: 50,
      isComplete: false,
      doneItemIds: ['i1'],
      eligibleItemIds: ['i1', 'i2'],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    markItemComplete: vi.fn(),
    getModulePercent: () => 50,
    ...overrides,
  } as any);
}

const successTables = (): Record<string, TableResult> => ({
  courses: { data: courseRow, error: null },
  modules: { data: [{ id: 'm1' }], error: null },
  content_items: { data: [{ id: 'i1', type: 'page' }, { id: 'i2', type: 'page' }], error: null },
  content_item_progressions: {
    data: [{ content_item_id: 'i1', workflow_state: 'completed' }],
    error: null,
  },
  assignments: { data: [{ id: 'a1', points: 100 }, { id: 'a2', points: 50 }], error: null },
  assignment_submissions: {
    data: [
      { assignment_id: 'a1', grade: 90 }, // 90%
      { assignment_id: 'a2', grade: 40 }, // 80%
    ],
    error: null,
  },
});

describe('CourseProgressOverview', () => {
  beforeEach(() => {
    (mockSupabaseClient.rpc as Mock).mockResolvedValue({ data: false, error: null });
    setProgressHook();
    mockTables(successTables());
  });

  it('computes the real average grade from assignment_submissions and never queries grades', async () => {
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);

    expect(await screen.findByText('Overall Progress')).toBeInTheDocument();
    // (90/100 + 40/50) / 2 = 85.0%
    expect(screen.getByText('85.0%')).toBeInTheDocument();
    expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();

    // REGRESSION: the grades table does not exist — it must never be queried.
    expect(tablesQueried()).toContain('assignment_submissions');
    expect(tablesQueried()).not.toContain('grades');
  });

  it('renders a distinct error state when a stats query fails', async () => {
    // REGRESSION: a failed fetch used to leave the loading skeleton up forever.
    mockTables({
      ...successTables(),
      // The one stats read left is the type of each eligible item (T-10 B); its failure must surface.
      content_items: { data: null, error: { message: 'connection refused', code: 'PGRST000' } },
    });

    const { container } = render(
      <CourseProgressOverview courseId="course-1" studentId="student-1" />,
    );

    expect(await screen.findByText('Failed to load course progress')).toBeInTheDocument();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
  });

  it('renders the error state when the progress hook itself fails', async () => {
    setProgressHook({
      data: undefined,
      isLoading: false,
      error: 'Failed to load course progress',
    });

    const { container } = render(
      <CourseProgressOverview courseId="course-1" studentId="student-1" />,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByText('Failed to load course progress').length).toBeGreaterThan(0);
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
  });
});

// T-10: the overview reads the same DONE set and eligible universe as useCourseProgress.
describe('CourseProgressOverview read model (T-10)', () => {
  const exactText = (t: string) => (_: string, el: Element | null) =>
    el?.tagName === 'DIV' && el.textContent === t;

  beforeEach(() => {
    (mockSupabaseClient.rpc as Mock).mockResolvedValue({ data: false, error: null });
  });

  it('per-type subtotals and the overall figure come from ONE snapshot (graded counts as done; non-eligible type rows ignored)', async () => {
    // Snapshot: 3 eligible items, 2 done (i1 read, a1 graded). The type table also returns x9, which is NOT eligible.
    setProgressHook({
      data: {
        modules: [{ moduleId: 'm1', totalItems: 3, completedItems: 2, percent: 67, isComplete: false }],
        totalItems: 3, completedItems: 2, percent: 67, isComplete: false,
        doneItemIds: ['i1', 'a1'], eligibleItemIds: ['i1', 'i2', 'a1'],
      },
    });
    mockTables({
      ...successTables(),
      content_items: { data: [{ id: 'i1', type: 'page' }, { id: 'i2', type: 'page' }, { id: 'a1', type: 'assignment' }, { id: 'x9', type: 'page' }], error: null },
    });
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('1 of 2 completed')).toBeInTheDocument(); // pages: i1 of i1,i2 (x9 ignored)
    expect(screen.getByText('1 of 1 submitted')).toBeInTheDocument(); // assignments: a1 graded
    expect(screen.getByText('0 of 0 completed')).toBeInTheDocument(); // quizzes
    expect(screen.getByText('67%')).toBeInTheDocument(); // overall = the same snapshot: 2 of 3
    // No second progress universe: the overview never reads progressions or modules itself.
    expect(tablesQueried()).not.toContain('content_item_progressions');
    expect(tablesQueried()).not.toContain('modules');
  });

  it('a same-count change of the done IDs re-derives every subtotal (no count-keyed cache)', async () => {
    const snap = (done: string[]) => ({
      data: {
        modules: [{ moduleId: 'm1', totalItems: 2, completedItems: 1, percent: 50, isComplete: false }],
        totalItems: 2, completedItems: 1, percent: 50, isComplete: false,
        doneItemIds: done, eligibleItemIds: ['i1', 'a1'],
      },
    });
    setProgressHook(snap(['i1']));
    mockTables({ ...successTables(), content_items: { data: [{ id: 'i1', type: 'page' }, { id: 'a1', type: 'assignment' }], error: null } });
    const { rerender } = render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('1 of 1 completed')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 submitted')).toBeInTheDocument();
    setProgressHook(snap(['a1']));
    rerender(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('0 of 1 completed')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 submitted')).toBeInTheDocument();
  });

  it('a same-count change of the eligible IDs re-reads the item types for the new universe', async () => {
    const snap = (eligible: string[]) => ({
      data: {
        modules: [{ moduleId: 'm1', totalItems: 2, completedItems: 0, percent: 0, isComplete: false }],
        totalItems: 2, completedItems: 0, percent: 0, isComplete: false,
        doneItemIds: [], eligibleItemIds: eligible,
      },
    });
    setProgressHook(snap(['i1', 'i2']));
    mockTables({ ...successTables(), content_items: { data: [{ id: 'i1', type: 'page' }, { id: 'i2', type: 'page' }, { id: 'q1', type: 'quiz' }], error: null } });
    const { rerender } = render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('0 of 2 completed')).toBeInTheDocument();
    setProgressHook(snap(['i1', 'q1']));
    rerender(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    // pages 0/1 (i1 only; i2 left the universe) and quizzes 0/1 (q1 joined it)
    expect(await screen.findAllByText('0 of 1 completed')).toHaveLength(2);
    expect(screen.queryByText('0 of 2 completed')).not.toBeInTheDocument();
  });

  it('a same-key refresh (isLoading) shows no stale figures', async () => {
    setProgressHook({ isLoading: true });
    mockTables(successTables());
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('totalModules counts eligible modules only, and module completion is exact (isComplete), not a percent', async () => {
    setProgressHook({
      data: {
        modules: [
          { moduleId: 'm1', totalItems: 2, completedItems: 2, percent: 100, isComplete: true },
          // A display percent near 100 is not completion.
          { moduleId: 'm2', totalItems: 200, completedItems: 199, percent: 99, isComplete: false },
        ],
        totalItems: 202,
        completedItems: 201,
        percent: 99,
        isComplete: false,
        doneItemIds: [],
        eligibleItemIds: [],
      },
    });
    mockTables({
      ...successTables(),
      // The course row lists a draft module too; it is not in the read model's universe.
      courses: {
        data: {
          ...courseRow,
          modules: [
            ...courseRow.modules,
            { id: 'm2', title: 'Module 2', description: '', order_index: 2, unlock_at: null, prerequisites_met: true },
            { id: 'mDraft', title: 'Draft', description: '', order_index: 3, unlock_at: null, prerequisites_met: true },
          ],
        },
        error: null,
      },
    });
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect((await screen.findAllByText(exactText('1/2'))).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(exactText('1/3'))).toHaveLength(0);
  });

  it('an empty universe renders 0/0 with no NaN anywhere', async () => {
    setProgressHook({
      data: {
        modules: [],
        totalItems: 0,
        completedItems: 0,
        percent: 0,
        isComplete: false,
        doneItemIds: [],
        eligibleItemIds: [],
      },
    });
    mockTables({
      ...successTables(),
      modules: { data: [], error: null },
      content_items: { data: [], error: null },
      content_item_progressions: { data: [], error: null },
    });
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect((await screen.findAllByText(exactText('0/0'))).length).toBeGreaterThan(0);
    expect(document.body.innerHTML).not.toContain('NaN');
  });

  it('does not promise a certificate from progress', async () => {
    setProgressHook();
    mockTables(successTables());
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('Overall Progress')).toBeInTheDocument();
    expect(screen.queryByText(/earn your certificate/i)).not.toBeInTheDocument();
  });
});
