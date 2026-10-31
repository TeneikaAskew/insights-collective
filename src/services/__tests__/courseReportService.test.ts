// ABOUTME: Tests for course report metrics — completion, module progression, work status, empty course, no cross-course rows.
// ABOUTME: Pure computeCourseReport against fixtures; fetch failure is covered via a mocked Supabase client.
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => {
  const b: any = { select: () => b, eq: () => b, in: () => b, then: (r: any) => r({ data: null, error: { message: 'boom' } }) };
  return { supabase: { from: () => b } };
});
import { computeCourseReport, fetchCourseReport } from '../courseReportService';

const L = (userId: string, progress: number, needsAttention = false) =>
  ({ userId, name: userId, avatarUrl: null, enrolledAt: '2026-01-01', progress, needsAttention });

const base = {
  learners: [L('u1', 100), L('u2', 50), L('u3', 0, true)],
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
  it('fetch failure throws instead of returning zeros', async () => {
    await expect(fetchCourseReport('c1')).rejects.toThrow('boom');
  });
});
