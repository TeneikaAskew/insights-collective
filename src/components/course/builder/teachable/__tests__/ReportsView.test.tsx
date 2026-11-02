// ABOUTME: Reports tab headline KPIs: progression-backed values, unknown progress shown as a dash, error state.
// ABOUTME: Supabase is faked in memory; enrollments.completion_status is set to misleading values on purpose.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { ReportsView } from '../ReportsView';

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('@/integrations/supabase/client', async () => {
  const { makeFakeClient } = await import('@/services/__tests__/fakeRosterSupabase');
  return { supabase: { from: (t: string) => makeFakeClient(state.db).from(t) } };
});

async function seed(withLessons: boolean) {
  const { makeFakeDb } = await import('@/services/__tests__/fakeRosterSupabase');
  return makeFakeDb({
    enrollments: [
      { course_id: 'c1', user_id: 'u1', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 0 },
      { course_id: 'c1', user_id: 'u2', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 100 },
    ],
    profiles: [],
    modules: withLessons ? [{ id: 'm1', course_id: 'c1', title: 'One', position: 1, published: true }] : [],
    content_items: withLessons ? [{ id: 'i1', module_id: 'm1', type: 'page', title: 'a', published: true }] : [],
    content_item_progressions: [{ user_id: 'u1', content_item_id: 'i1', workflow_state: 'read' }],
    assignments: [],
    quizzes: [],
  });
}

const kpi = (label: RegExp) => screen.getByText(label).closest('div') as HTMLElement;

beforeEach(async () => { state.db = await seed(true); });

describe('ReportsView headline metrics (T-15)', () => {
  it('computes completion and average progress from progressions', async () => {
    render(<ReportsView courseId="c1" courseTitle="Data 101" />);
    await screen.findByText('Completion rate');
    expect(kpi(/^Completion rate$/)).toHaveTextContent('50%');
    expect(kpi(/^Completion rate$/)).toHaveTextContent('1 of 2 learners finished every published lesson.');
    expect(kpi(/^Average progress$/)).toHaveTextContent('50%');
  });

  it('shows unknown, not 0% or 100%, when there are no published lessons', async () => {
    state.db = await seed(false);
    render(<ReportsView courseId="c1" courseTitle="Data 101" />);
    await screen.findByText('Completion rate');
    expect(kpi(/^Completion rate$/)).toHaveTextContent('—');
    expect(kpi(/^Average progress$/)).toHaveTextContent('—');
    expect(screen.getAllByText(/unknown: no published lessons/i)).toHaveLength(2);
  });

  it('shows an error, not zeros, when a read fails', async () => {
    state.db.failTables = { content_item_progressions: 'denied' };
    render(<ReportsView courseId="c1" courseTitle="Data 101" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
  });
});
