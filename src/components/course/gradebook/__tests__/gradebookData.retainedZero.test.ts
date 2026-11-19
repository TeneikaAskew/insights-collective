import { describe, expect, it } from 'vitest';
import { buildGradebook, buildGradebookCsvRows } from '../gradebookData';

function input() {
  return {
    students: [{ id: 's1', full_name: 'Ada' }, { id: 's2', full_name: 'Bob' }],
    assignments: [], quizzes: [{ id: 'q1', title: 'Quiz', points: 10 }],
    assignmentSubmissions: [],
    quizSubmissions: [
      { id: 'old', user_id: 's1', quiz_id: 'q1', score: 8, kept_score: null, attempt: 1, workflow_state: 'complete' },
      { id: 'retained-zero', user_id: 's1', quiz_id: 'q1', score: 9, kept_score: 0, attempt: 2, workflow_state: 'complete' },
      { id: 'unfinished', user_id: 's1', quiz_id: 'q1', score: null, kept_score: null, attempt: 3, workflow_state: 'untaken' },
      { id: 'other-student', user_id: 's2', quiz_id: 'q1', score: 7, kept_score: null, attempt: 9, workflow_state: 'complete' },
    ],
  };
}

describe('retained zero gradebook contract', () => {
  it.each([false, true])('preserves retained zero and student isolation with reversed rows=%s', (reverse) => {
    const data = input();
    if (reverse) data.quizSubmissions.reverse();
    const before = structuredClone(data);
    const model = buildGradebook(data);
    expect(model.cells['s1-q1']).toMatchObject({ submissionId: 'retained-zero', attempt: 2, pointsEarned: 0, status: 'graded', percentage: 0 });
    expect(model.totals.s1).toEqual({ earned: 0, possible: 10, percentage: 0, gradedCount: 1 });
    expect(model.cells['s2-q1']).toMatchObject({ submissionId: 'other-student', pointsEarned: 7, percentage: 70 });
    expect(model.totals.s2).toEqual({ earned: 7, possible: 10, percentage: 70, gradedCount: 1 });
    const rows = buildGradebookCsvRows(data.students, [{ ...data.quizzes[0], type: 'quiz' }], model);
    expect(rows.slice(1)).toEqual([
      ['s1', 'Ada', '', 0, 10, 'graded', 0, 10, 0],
      ['s2', 'Bob', '', 7, 10, 'graded', 7, 10, 70],
    ]);
    expect(data).toEqual(before);
  });
});
