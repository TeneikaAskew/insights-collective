// ABOUTME: Tests for ModuleProgressCard (T-10 r2): completion figures come only from the canonical snapshot slice;
// ABOUTME: the detail query reads eligible items and assessment status, never a second completion count.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { ModuleProgressCard, moduleBreakdown } from '../ModuleProgressCard';

type QueryResult = { data?: unknown; error?: unknown };

function makeTableBuilder(result: QueryResult) {
  const builder: any = {};
  const promise = Promise.resolve({ data: null, error: null, ...result });
  for (const m of [
    'select', 'eq', 'neq', 'in', 'is', 'order', 'limit',
    'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => promise);
  builder.maybeSingle = vi.fn(() => promise);
  builder.then = (f: any, r: any) => promise.then(f, r);
  return builder;
}

function mockTables(tables: Record<string, QueryResult>) {
  const builders: Record<string, any> = {};
  const queried: string[] = [];
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    queried.push(table);
    if (!builders[table]) builders[table] = makeTableBuilder(tables[table] ?? {});
    return builders[table];
  });
  return { builders, queried };
}

// Module m1: page p1 (done), assignment item a1 (done: stored progress), quiz item q1 (not done). 2 of 3.
const snapshot = { totalItems: 3, completedItems: 2, percent: 67, isComplete: false, itemIds: ['p1', 'a1', 'q1'] };
const done = new Set(['p1', 'a1']);
const types = new Map([['p1', 'page'], ['a1', 'assignment'], ['q1', 'quiz']]);

function stubDetails(overrides: Record<string, QueryResult> = {}) {
  return mockTables({
    content_items: {
      data: [
        { id: 'p1', title: 'Reading', type: 'page', position: 1 },
        { id: 'a1', title: 'Essay', type: 'assignment', position: 2 },
        { id: 'q1', title: 'Quiz 1', type: 'quiz', position: 3 },
      ],
    },
    // The assessment rows the old card COUNTED in addition to the content items: here the essay's submission is only
    // submitted (not graded) and the quiz has no finished attempt. Neither may change any count.
    assignments: { data: [{ id: 'A1', points: 10, content_item_id: 'a1', submissions: [{ id: 's1', workflow_state: 'submitted', grade: null, submitted_at: '2026-11-01T00:00:00Z' }] }] },
    quizzes: { data: [{ id: 'Q1', points_possible: 5, content_item_id: 'q1', attempts: [] }] },
    ...overrides,
  });
}

const props = { moduleId: 'm1', moduleTitle: 'Week 1', studentId: 'user-1', snapshot, doneItemIds: done, typeById: types };

describe('ModuleProgressCard (T-10 r2)', () => {
  it('summary card: figures, percent, badge and breakdown come from the snapshot; no table is read', async () => {
    const { queried } = mockTables({});
    render(<ModuleProgressCard {...props} showDetails={false} />);
    expect(screen.getByText('2/3 items completed')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTestId('module-breakdown-page')).toHaveTextContent('1/1');
    expect(screen.getByTestId('module-breakdown-assignment')).toHaveTextContent('1/1');
    expect(screen.getByTestId('module-breakdown-quiz')).toHaveTextContent('0/1');
    // Providers may read page_visibility; no progress or content table is read by the summary card.
    expect(queried.filter((t) => t !== 'page_visibility')).toEqual([]);
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('details: reads only eligible items and assessment rows by content_item_id; assessment status is separate from the checkmark', async () => {
    const { builders } = stubDetails();
    render(<ModuleProgressCard {...props} showDetails={true} />);
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    const essay = await screen.findByTestId('module-item-a1');
    // Stored progress says done; the assessment fact says only submitted. Both are shown, neither overrides the other.
    expect(essay).toHaveAttribute('data-done', 'true');
    expect(within(essay).getByTestId('assessment-a1')).toHaveTextContent('Submitted, not graded');
    expect(screen.getByTestId('assessment-q1')).toHaveTextContent('No completed attempt');
    // Counts unchanged by the details read (the old card would have shown 2/5 = 40%: 3 items plus 2 assessment rows).
    expect(screen.getByText('2/3 items completed')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(builders['content_items'].in).toHaveBeenCalledWith('id', ['p1', 'a1', 'q1']);
    expect(builders['assignments'].in).toHaveBeenCalledWith('content_item_id', ['p1', 'a1', 'q1']);
    expect(builders['assignments'].eq).toHaveBeenCalledWith('submissions.user_id', 'user-1');
    expect(builders['quizzes'].eq).toHaveBeenCalledWith('attempts.user_id', 'user-1');
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('content_item_progressions');
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('lesson_completions');
  });

  it('a graded submission and a finished quiz attempt are reported as assessment status', async () => {
    stubDetails({
      assignments: { data: [{ id: 'A1', points: 10, content_item_id: 'a1', submissions: [{ id: 's1', workflow_state: 'graded', grade: 9 }] }] },
      quizzes: { data: [{ id: 'Q1', points_possible: 5, content_item_id: 'q1', attempts: [{ id: 'x', score: 4, workflow_state: 'complete' }] }] },
    });
    render(<ModuleProgressCard {...props} showDetails={true} />);
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(await screen.findByTestId('assessment-a1')).toHaveTextContent('Graded 9/10');
    expect(screen.getByTestId('assessment-q1')).toHaveTextContent('Attempt complete 4/5');
    // A finished attempt does not tick a stored-progress checkmark.
    expect(screen.getByTestId('module-item-q1')).toHaveAttribute('data-done', 'false');
    expect(screen.getByText('2/3 items completed')).toBeInTheDocument();
  });

  // r2 consolidated (B): the stored graded state survives a NULL grade; grade 0 is a real score.
  const gradedCase = (sub: Record<string, unknown>) =>
    stubDetails({ assignments: { data: [{ id: 'A1', points: 10, content_item_id: 'a1', submissions: [{ id: 's1', ...sub }] }] } });
  const openDetails = async () => {
    render(<ModuleProgressCard {...props} showDetails={true} />);
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    return screen.findByTestId('assessment-a1');
  };

  it('graded with NULL grade and a submitted_at reads graded, score unavailable (not "Submitted, not graded")', async () => {
    gradedCase({ workflow_state: 'graded', grade: null, submitted_at: '2026-11-01T00:00:00Z' });
    const el = await openDetails();
    expect(el).toHaveTextContent('Graded, score unavailable');
    expect(el).not.toHaveTextContent(/Submitted, not graded|No submission/);
  });

  it('graded with NULL grade and NO submitted_at reads graded, score unavailable (not "No submission")', async () => {
    gradedCase({ workflow_state: 'graded', grade: null, submitted_at: null });
    const el = await openDetails();
    expect(el).toHaveTextContent('Graded, score unavailable');
    expect(el).not.toHaveTextContent(/Submitted, not graded|No submission/);
  });

  it('graded with grade 0 is a real score: Graded 0/10', async () => {
    gradedCase({ workflow_state: 'graded', grade: 0, submitted_at: '2026-11-01T00:00:00Z' });
    expect(await openDetails()).toHaveTextContent('Graded 0/10');
  });

  it('renders the details error state with retry when a details query fails', async () => {
    stubDetails({ content_items: { data: null, error: { message: 'boom' } } });
    render(<ModuleProgressCard {...props} showDetails={true} />);
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(await screen.findByText(/Failed to load details for Week 1/i)).toBeInTheDocument();
    expect(screen.getByText('2/3 items completed')).toBeInTheDocument();
  });

  it('missing type metadata for one of the module items makes the breakdown Unknown, not a smaller count', () => {
    mockTables({});
    render(<ModuleProgressCard {...props} typeById={new Map([['p1', 'page'], ['a1', 'assignment']])} showDetails={false} />);
    expect(screen.getByTestId('module-breakdown-page')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('module-breakdown-quiz')).toHaveTextContent('Unknown');
    expect(screen.getByText('2/3 items completed')).toBeInTheDocument();
  });

  it('moduleBreakdown: extra type rows are ignored, a missing one gives null, graded-done counts as done', () => {
    const extra = new Map([...types, ['zz', 'page']]);
    expect(moduleBreakdown(['p1', 'a1', 'q1'], done, extra)).toEqual({
      page: { done: 1, total: 1 }, assignment: { done: 1, total: 1 }, quiz: { done: 0, total: 1 },
    });
    expect(moduleBreakdown(['p1', 'a1', 'q1'], done, new Map([['p1', 'page']]))).toBeNull();
    expect(moduleBreakdown(['p1'], done, null)).toBeNull();
  });

  it('badge Completed only for an exactly complete snapshot', () => {
    mockTables({});
    render(<ModuleProgressCard {...props} snapshot={{ ...snapshot, completedItems: 3, percent: 100, isComplete: true }} doneItemIds={new Set(['p1', 'a1', 'q1'])} showDetails={false} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
