// ABOUTME: Tests for course report metrics — completion, module progression, work status, empty course, no cross-course rows.
// ABOUTME: Pure computeCourseReport against fixtures; fetch failure is covered via a mocked Supabase client.
import { describe, it, expect, vi } from 'vitest';
import { makeFakeClient, makeFakeDb, type FakeDb } from './fakeRosterSupabase';

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => makeFakeClient(h.db).from(t) },
}));
import { computeCourseReport, fetchCourseReport } from '../courseReportService';

// Fixture learners carry consistent exact counts; progress is only their rounded display value.
const L = (userId: string, completedItems: number, totalItems: number, needsAttention = false) => ({
  userId, name: userId, avatarUrl: null, enrolledAt: '2026-01-01', completedItems, totalItems,
  progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null, needsAttention,
});

const base = {
  learners: [L('u1', 2, 2), L('u2', 1, 2), L('u3', 0, 2, true)],
  modules: [{ id: 'm1', title: 'Intro', position: 1 }],
  items: [{ id: 'i1', module_id: 'm1', type: 'page', title: 'a' }, { id: 'i2', module_id: 'm1', type: 'page', title: 'b' }],
  progressions: [
    { user_id: 'u1', content_item_id: 'i1', workflow_state: 'read' },
    { user_id: 'u1', content_item_id: 'i2', workflow_state: 'completed' },
    { user_id: 'u2', content_item_id: 'i1', workflow_state: 'read' },
    { user_id: 'u2', content_item_id: 'i2', workflow_state: 'started' },
    { user_id: 'outsider', content_item_id: 'i1', workflow_state: 'read' },
    { user_id: 'u3', content_item_id: 'other-course-item', workflow_state: 'read' },
  ],
  assignments: [{ id: 'a1', points: 10 }],
  quizzes: [{ id: 'q1', points: 5 }],
  assignmentSubmissions: [
    { id: 's1', user_id: 'u1', assignment_id: 'a1', grade: 0, workflow_state: 'graded' },
    { id: 's2', user_id: 'u2', assignment_id: 'a1', grade: null, workflow_state: 'submitted', submitted_at: 'x' },
  ],
  quizSubmissions: [{ id: 'z1', user_id: 'u1', quiz_id: 'q1', score: 4, workflow_state: 'complete' }],
};

describe('computeCourseReport', () => {
  it('computes enrollment and completion KPIs', () => {
    const r = computeCourseReport(base);
    expect(r.enrolled).toBe(3);
    expect(r.measured).toBe(3);
    expect(r.completed).toBe(1);
    expect(r.completionRate).toBe(33);
    expect(r.avgProgress).toBe(50);
    expect(r.notStarted).toBe(1);
  });
  it('module progression ignores non-enrolled users and other courses\' items', () => {
    const m = computeCourseReport(base).modules[0];
    expect(m.learnersCompleted).toBe(1);
    expect(m.avgCompletion).toBe(50); // (1 + 0.5 + 0) / 3
  });
  it('work status matches gradebook rules (0 is graded)', () => {
    expect(computeCourseReport(base).work).toEqual({ graded: 2, awaitingGrading: 1, notSubmitted: 3, total: 6 });
  });
  it('empty course gives null rates, not zeros', () => {
    const r = computeCourseReport({ ...base, learners: [], progressions: [] });
    expect(r.completionRate).toBeNull();
    expect(r.avgProgress).toBeNull();
    expect(r.modules[0].avgCompletion).toBeNull();
  });
  it('unknown learner progress is excluded from rates, not counted as 0 (T-15)', () => {
    const r = computeCourseReport({ ...base, learners: [L('u1', 2, 2), L('u2', 0, 0), L('u3', 0, 0)] });
    expect(r.measured).toBe(1);
    expect(r.completionRate).toBe(100);
    expect(r.avgProgress).toBe(100);
  });
  it('199/200 is not counted as completed although it displays 100%', () => {
    const r = computeCourseReport({ ...base, learners: [L('u1', 199, 200), L('u2', 200, 200)] });
    expect(r.completed).toBe(1);
    expect(r.completionRate).toBe(50);
  });
  it('average uses exact shares (0/6 and 1/6 give 8%)', () => {
    expect(computeCourseReport({ ...base, learners: [L('u1', 0, 6), L('u2', 1, 6)] }).avgProgress).toBe(8);
  });
  it('no measurable learners gives unknown rates', () => {
    const r = computeCourseReport({ ...base, learners: [L('u1', 0, 0), L('u2', 0, 0)] });
    expect(r.completionRate).toBeNull();
    expect(r.avgProgress).toBeNull();
  });
  it('fetch failure throws instead of returning zeros', async () => {
    h.db = makeFakeDb();
    h.db.fail = 'boom';
    await expect(fetchCourseReport('c1')).rejects.toThrow('boom');
  });
  it('headline metrics come from progressions, not enrollments.completion_status (T-15)', async () => {
    h.db = makeFakeDb({
      enrollments: [
        { course_id: 'c1', user_id: 'u1', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 0 },
        { course_id: 'c1', user_id: 'u2', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 80 },
      ],
      profiles: [],
      modules: [{ id: 'm1', course_id: 'c1', title: 'One', position: 1, published: true }],
      content_items: [
        { id: 'i1', module_id: 'm1', course_id: 'c1', type: 'page', title: 'a', published: true },
        { id: 'i2', module_id: 'm1', course_id: 'c1', type: 'page', title: 'b', published: true },
      ],
      content_item_progressions: [
        { user_id: 'u1', content_item_id: 'i1', workflow_state: 'read' },
        { user_id: 'u1', content_item_id: 'i2', workflow_state: 'completed' },
      ],
      assignments: [],
      quizzes: [],
    });
    const r = await fetchCourseReport('c1');
    expect(r.completed).toBe(1);
    expect(r.completionRate).toBe(50);
    expect(r.avgProgress).toBe(50);
    expect(r.modules[0]).toMatchObject({ learnersCompleted: 1, avgCompletion: 50 });
  });
  it('a course with no published lessons reports unknown progress', async () => {
    h.db = makeFakeDb({
      enrollments: [{ course_id: 'c1', user_id: 'u1', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 100 }],
      profiles: [], modules: [], content_items: [], content_item_progressions: [], assignments: [], quizzes: [],
    });
    const r = await fetchCourseReport('c1');
    expect(r.enrolled).toBe(1);
    expect(r.measured).toBe(0);
    expect(r.completionRate).toBeNull();
    expect(r.avgProgress).toBeNull();
  });
});
