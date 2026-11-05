// ABOUTME: T-10 r2 (2): the Overview with the REAL ModuleProgressCard child against a mocked backend. Module figures
// ABOUTME: come from the canonical snapshot; a separate assessment row never adds to them; draft modules get no card.
import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, within } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { CourseProgressOverview } from '../CourseProgressOverview';

vi.mock('@/hooks/useCourseProgress', () => ({ useCourseProgress: vi.fn() }));
// NOTE: ModuleProgressCard is deliberately NOT mocked here.

type TableResult = { data: unknown; error: { message: string } | null };
function tableBuilder(result: TableResult) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'filter']) b[m] = vi.fn(() => b);
  const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
  b.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
  b.then = (f: any, r: any) => Promise.resolve(result).then(f, r);
  return b;
}

// The contradiction from the r2 review: page p1 and assignment item a1 are both DONE in stored progress (a1 via the
// canonical 'graded' state), so the snapshot says 2/2 = 100%. The backend ALSO has an assignment row for a1 and an
// unrelated quiz row in the module. The old card recounted content items PLUS those rows with other predicates
// (graded excluded from progressions), giving 2/3 = 67% under a 100% header.
const tables: Record<string, TableResult> = {
  courses: {
    data: {
      id: 'course-1', title: 'Course',
      modules: [
        { id: 'm1', title: 'Week 1', position: 1, prerequisite_module_ids: null },
        { id: 'mDraft', title: 'Draft week', position: 2, prerequisite_module_ids: null },
      ],
    },
    error: null,
  },
  content_items: { data: [{ id: 'p1', type: 'page', title: 'Reading', position: 1 }, { id: 'a1', type: 'assignment', title: 'Essay', position: 2 }], error: null },
  content_item_progressions: { data: [{ content_item_id: 'p1', workflow_state: 'read' }, { content_item_id: 'a1', workflow_state: 'graded' }], error: null },
  assignments: { data: [{ id: 'A1', points: 10, content_item_id: 'a1', submissions: [{ id: 's', workflow_state: 'submitted', grade: null, submitted_at: '2026-11-01T00:00:00Z' }] }], error: null },
  quizzes: { data: [{ id: 'Qx', points_possible: 5, content_item_id: 'not-eligible', attempts: [] }], error: null },
  assignment_submissions: { data: [], error: null },
  certificates: { data: [], error: null },
};

beforeEach(() => {
  (mockSupabaseClient.from as Mock).mockImplementation((t: string) => tableBuilder(tables[t] ?? { data: [], error: null }));
  vi.mocked(useCourseProgress).mockReturnValue({
    data: {
      modules: [{ moduleId: 'm1', totalItems: 2, completedItems: 2, percent: 100, isComplete: true, itemIds: ['p1', 'a1'] }],
      totalItems: 2, completedItems: 2, percent: 100, isComplete: true,
      doneItemIds: ['p1', 'a1'], eligibleItemIds: ['p1', 'a1'],
    },
    isLoading: false, error: null, refetch: vi.fn(), markItemComplete: vi.fn(), getModulePercent: () => 100,
  } as any);
});

describe('CourseProgressOverview modules with the real ModuleProgressCard (T-10 r2)', () => {
  it('module figures equal the top snapshot (2/2, 100%, Completed), not a recount (2/3, 67%)', async () => {
    render(<CourseProgressOverview courseId="course-1" studentId="student-1" />);
    expect(await screen.findByText('Overall Progress')).toBeInTheDocument();
    // Behavioural first (independent of new test ids): once module figures render, they read 2/2, never 2/3.
    expect((await screen.findAllByText(/^\d+\/\d+ items completed$/))[0]).toHaveTextContent('2/2 items completed');
    expect(screen.queryByText('2/3 items completed')).toBeNull();
    const cards = await screen.findAllByTestId('module-card-m1');
    for (const card of cards) {
      expect(within(card).getByText('2/2 items completed')).toBeInTheDocument();
      expect(within(card).getByText('100%')).toBeInTheDocument();
      expect(within(card).getByText('Completed')).toBeInTheDocument();
      expect(within(card).queryByText('67%')).toBeNull();
      expect(within(card).queryByText(/2\/3/)).toBeNull();
      // Per-type cells from the snapshot: graded-done assignment counts as done.
      expect(within(card).getByTestId('module-breakdown-assignment')).toHaveTextContent('1/1');
      expect(within(card).getByTestId('module-breakdown-quiz')).toHaveTextContent('0/0');
    }
    // A module outside the snapshot (draft) gets no card at all.
    expect(screen.queryByTestId('module-card-mDraft')).toBeNull();
    expect(screen.queryByText('Draft week')).toBeNull();
    // No component recounts progress from progressions.
    expect((mockSupabaseClient.from as Mock).mock.calls.map((c) => c[0])).not.toContain('content_item_progressions');
  });
});
