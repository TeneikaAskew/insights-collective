import { describe, it, expect } from 'vitest';
import { computeDashboardMetrics } from '../dashboardMetrics';

describe('computeDashboardMetrics', () => {
  it('returns zero for a learner with no enrollments', () => {
    expect(computeDashboardMetrics([], [], [])).toEqual({
      enrolled: 0,
      inProgress: 0,
      completed: 0,
    });
  });

  it('counts an enrolled course with at least one read/completed progression as in progress', () => {
    const m = computeDashboardMetrics(
      [{ course_id: 'c1' }],
      [{ course_id: 'c1', workflow_state: 'read' }],
      [],
    );
    expect(m.inProgress).toBe(1);
    expect(m.completed).toBe(0);
  });

  it('does not count enrolled courses with no progressions as in progress', () => {
    const m = computeDashboardMetrics([{ course_id: 'c1' }], [], []);
    expect(m).toEqual({ enrolled: 1, inProgress: 0, completed: 0 });
  });

  it('excludes courses that already have a certificate from in progress and counts them as completed', () => {
    const m = computeDashboardMetrics(
      [{ course_id: 'c1' }, { course_id: 'c2' }],
      [
        { course_id: 'c1', workflow_state: 'completed' },
        { course_id: 'c2', workflow_state: 'read' },
      ],
      [{ course_id: 'c1' }],
    );
    expect(m).toEqual({ enrolled: 2, inProgress: 1, completed: 1 });
  });

  it('ignores non read/completed workflow states', () => {
    const m = computeDashboardMetrics(
      [{ course_id: 'c1' }],
      [{ course_id: 'c1', workflow_state: 'unread' }],
      [],
    );
    expect(m.inProgress).toBe(0);
  });

  it('ignores certificates for courses the learner is not enrolled in', () => {
    const m = computeDashboardMetrics([{ course_id: 'c1' }], [], [{ course_id: 'other' }]);
    expect(m.completed).toBe(0);
  });
});
