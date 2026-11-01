// ABOUTME: The assignment grading contract: assignments.points is the denominator, grade outranks the older score
// ABOUTME: column, 0 is real, and a grade save counts only when exactly one row reads back with the sent grade.
import { describe, it, expect } from 'vitest';
import { assignmentPointsPossible, submissionEarnedPoints, assertGradeSaved } from '../assignmentGrading';
import { buildGradebook, buildGradebookCsvRows } from '@/components/course/gradebook/gradebookData';

describe('assignmentPointsPossible', () => {
  it('reads the real points column', () => {
    expect(assignmentPointsPossible({ points: 10 })).toBe(10);
    expect(assignmentPointsPossible({ points: '10' })).toBe(10); // numeric columns can arrive as strings
  });
  it('never lets a legacy points_possible alias override points', () => {
    expect(assignmentPointsPossible({ points: 10, points_possible: 100 })).toBe(10);
    expect(assignmentPointsPossible({ points_possible: 25 })).toBe(25);
  });
  it('returns null (not an invented 100) when neither is set', () => {
    expect(assignmentPointsPossible({ points: null })).toBeNull();
    expect(assignmentPointsPossible(undefined)).toBeNull();
  });
});

describe('submissionEarnedPoints', () => {
  it('uses grade, keeps 0, and falls back to score only when grade is NULL', () => {
    expect(submissionEarnedPoints({ grade: 0, score: null })).toBe(0);
    expect(submissionEarnedPoints({ grade: 7, score: null })).toBe(7);
    expect(submissionEarnedPoints({ grade: 7, score: 3 })).toBe(7);
    expect(submissionEarnedPoints({ grade: null, score: 3 })).toBe(3);
    expect(submissionEarnedPoints({ grade: null, score: null })).toBeNull();
  });
});

describe('assertGradeSaved', () => {
  it('accepts exactly one row carrying the sent grade, including 0', () => {
    expect(assertGradeSaved([{ id: 's', grade: 0 }], 's', 0)).toEqual({ id: 's', grade: 0 });
  });
  it('rejects zero rows, extra rows, a different id, and a reverted grade', () => {
    expect(() => assertGradeSaved([], 's', 7)).toThrow(/not updated/);
    expect(() => assertGradeSaved(null, 's', 7)).toThrow(/not updated/);
    expect(() => assertGradeSaved([{ id: 's', grade: 7 }, { id: 't', grade: 7 }], 's', 7)).toThrow(/not updated/);
    expect(() => assertGradeSaved([{ id: 't', grade: 7 }], 's', 7)).toThrow(/not updated/);
    expect(() => assertGradeSaved([{ id: 's', grade: null }], 's', 7)).toThrow(/did not change/);
  });
});

describe('10-point assignment: totals and CSV agree with the per-cell grades', () => {
  const students = [{ id: 's0', full_name: 'Zero' }, { id: 's7', full_name: 'Seven' }];
  // Real-schema rows: assignments.points = 10; submissions carry grade with score NULL.
  const assignmentRows = [{ id: 'a1', title: 'Essay', points: 10 }, { id: 'a2', title: 'Lab', points: 10 }];
  const subs = [
    { id: 'x0', user_id: 's0', assignment_id: 'a1', grade: 0, score: null, workflow_state: 'graded' },
    { id: 'x7', user_id: 's7', assignment_id: 'a1', grade: 7, score: null, workflow_state: 'graded' },
    { id: 'y7', user_id: 's7', assignment_id: 'a2', grade: 7, score: null, workflow_state: 'graded' },
  ];
  const items = assignmentRows.map((a) => ({ id: a.id, title: a.title, points: assignmentPointsPossible(a) }));
  const model = buildGradebook({ students, assignments: items, quizzes: [], assignmentSubmissions: subs, quizSubmissions: [] });

  it('scores against 10, not 100', () => {
    expect(model.cells['s0-a1']).toMatchObject({ pointsEarned: 0, pointsPossible: 10, percentage: 0, status: 'graded' });
    expect(model.cells['s7-a1']).toMatchObject({ pointsEarned: 7, pointsPossible: 10, percentage: 70 });
    expect(model.totals.s0).toMatchObject({ earned: 0, possible: 10, percentage: 0 });
    expect(model.totals.s7).toMatchObject({ earned: 14, possible: 20, percentage: 70 });
  });

  it('writes the same numbers to CSV', () => {
    const rows = buildGradebookCsvRows(students, items.map((i) => ({ ...i, type: 'assignment' as const })), model);
    expect(rows[1]).toEqual(['s0', 'Zero', '', 0, 10, 'graded', undefined, 10, 'missing', 0, 10, 0]);
    expect(rows[2]).toEqual(['s7', 'Seven', '', 7, 10, 'graded', 7, 10, 'graded', 14, 20, 70]);
  });
});
