import { expect, it } from 'vitest';
import { buildGradebook, buildGradebookCsvRows } from '../gradebookData';

it('keeps assignment and quiz identities separate in cells, totals and CSV', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const data = {
    students: [{ id: 's1', full_name: 'Ada' }, { id: 's2', full_name: 'Bob' }],
    assignments: [{ id, title: 'Essay', points: 100 }],
    quizzes: [{ id, title: 'Quiz', points: 10 }],
    assignmentSubmissions: [{ id: 'assignment-sub', user_id: 's1', assignment_id: id, grade: 80, attempt: 1, workflow_state: 'graded' }],
    quizSubmissions: [{ id: 'quiz-sub', user_id: 's1', quiz_id: id, score: 6, attempt: 1, workflow_state: 'complete' }],
  };
  const before = structuredClone(data);
  const model = buildGradebook(data);
  expect(Object.values(model.cells)).toHaveLength(4);
  expect(Object.values(model.cells)).toEqual(expect.arrayContaining([
    expect.objectContaining({ studentId: 's1', itemId: id, itemType: 'assignment', pointsEarned: 80, submissionId: 'assignment-sub' }),
    expect.objectContaining({ studentId: 's1', itemId: id, itemType: 'quiz', pointsEarned: 6, submissionId: 'quiz-sub' }),
    expect.objectContaining({ studentId: 's2', itemId: id, itemType: 'assignment', status: 'missing' }),
    expect.objectContaining({ studentId: 's2', itemId: id, itemType: 'quiz', status: 'missing' }),
  ]));
  expect(model.totals.s1).toEqual({ earned: 86, possible: 110, percentage: 86 / 110 * 100, gradedCount: 2 });
  expect(model.totals.s2).toEqual({ earned: 0, possible: 0, percentage: undefined, gradedCount: 0 });
  const rows = buildGradebookCsvRows(data.students, [{ ...data.assignments[0], type: 'assignment' }, { ...data.quizzes[0], type: 'quiz' }], model);
  expect(rows[1]).toEqual(['s1', 'Ada', '', 80, 100, 'graded', 6, 10, 'graded', 86, 110, 78.18]);
  expect(rows[2]).toEqual(['s2', 'Bob', '', undefined, 100, 'missing', undefined, 10, 'missing', 0, 0, undefined]);
  expect(data).toEqual(before);
});
