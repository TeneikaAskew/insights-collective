// ABOUTME: Tests for the normalized gradebook model and CSV: 0 vs missing, latest quiz attempt,
// ABOUTME: totals over graded items, CSV escaping, Excel BOM/CRLF and formula-injection neutralising.
import { describe, it, expect } from 'vitest';
import { buildGradebook, buildGradebookCsvRows, csvCell, toCsv } from '../gradebookData';

const students = [{ id: 's1', full_name: 'Ada' }, { id: 's2', full_name: 'Bob' }];
const assignments = [{ id: 'a1', title: 'Essay', points: 100 }];
const quizzes = [{ id: 'q1', title: 'Quiz', points: 10 }];

function model(over: Partial<Parameters<typeof buildGradebook>[0]> = {}) {
  return buildGradebook({ students, assignments, quizzes, assignmentSubmissions: [], quizSubmissions: [], ...over });
}

describe('buildGradebook', () => {
  it('keeps a legitimate 0 as a graded 0, not missing', () => {
    const m = model({ assignmentSubmissions: [{ id: 'x', user_id: 's1', assignment_id: 'a1', grade: 0, workflow_state: 'graded' }] });
    expect(m.cells['s1-a1']).toMatchObject({ pointsEarned: 0, status: 'graded', percentage: 0 });
    expect(m.totals.s1).toMatchObject({ earned: 0, possible: 100, percentage: 0 });
  });

  it('marks no submission as missing with no points and no percentage', () => {
    const m = model();
    expect(m.cells['s2-a1']).toMatchObject({ pointsEarned: undefined, status: 'missing' });
    expect(m.totals.s2.percentage).toBeUndefined();
  });

  it('marks a submitted-but-ungraded assignment as submitted', () => {
    const m = model({ assignmentSubmissions: [{ id: 'x', user_id: 's1', assignment_id: 'a1', grade: null, workflow_state: 'submitted' }] });
    expect(m.cells['s1-a1'].status).toBe('submitted');
  });

  it('uses the latest assignment attempt', () => {
    const m = model({ assignmentSubmissions: [
      { id: 'n2', user_id: 's1', assignment_id: 'a1', grade: 80, attempt: 2, workflow_state: 'graded' },
      { id: 'n1', user_id: 's1', assignment_id: 'a1', grade: 40, attempt: 1, workflow_state: 'graded' },
    ] });
    expect(m.cells['s1-a1']).toMatchObject({ pointsEarned: 80, attempt: 2, submissionId: 'n2' });
  });

  it('uses the latest scored quiz attempt, preferring kept_score, ignoring unscored attempts', () => {
    const m = model({ quizSubmissions: [
      { id: 'q-1', user_id: 's1', quiz_id: 'q1', score: 9, attempt: 1, workflow_state: 'complete' },
      { id: 'q-2', user_id: 's1', quiz_id: 'q1', score: 3, kept_score: 4, attempt: 2, workflow_state: 'complete' },
      { id: 'q-3', user_id: 's1', quiz_id: 'q1', score: null, attempt: 3, workflow_state: 'untaken' },
    ] });
    expect(m.cells['s1-q1']).toMatchObject({ pointsEarned: 4, attempt: 2, status: 'graded' });
  });

  it('a quiz scored 0 is graded 0; pending_review shows as submitted', () => {
    const m = model({ quizSubmissions: [
      { id: 'z', user_id: 's1', quiz_id: 'q1', score: 0, attempt: 1, workflow_state: 'complete' },
      { id: 'p', user_id: 's2', quiz_id: 'q1', score: 5, attempt: 1, workflow_state: 'pending_review' },
    ] });
    expect(m.cells['s1-q1']).toMatchObject({ pointsEarned: 0, status: 'graded' });
    expect(m.cells['s2-q1'].status).toBe('submitted');
  });

  it('totals only count graded items', () => {
    const m = model({ quizSubmissions: [{ id: 'z', user_id: 's1', quiz_id: 'q1', score: 8, attempt: 1, workflow_state: 'complete' }] });
    expect(m.totals.s1).toMatchObject({ earned: 8, possible: 10, percentage: 80, gradedCount: 1 });
  });
});

describe('csv', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises formula prefixes, including after whitespace/control chars', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('  =HYPERLINK("x")')).toBe(`"'  =HYPERLINK(""x"")"`);
    expect(csvCell('\t=1')).toBe("'\t=1");
  });

  it('keeps numbers numeric, including 0, and blanks for missing', () => {
    expect(csvCell(0)).toBe('0');
    expect(csvCell(undefined)).toBe('');
  });

  it('builds rows from the same model as the table', () => {
    const m = model({
      assignmentSubmissions: [{ id: 'x', user_id: 's1', assignment_id: 'a1', grade: 0, workflow_state: 'graded' }],
    });
    const rows = buildGradebookCsvRows(
      [{ id: 's1', full_name: '=Evil, Name' }],
      [{ ...assignments[0], type: 'assignment' }, { ...quizzes[0], type: 'quiz' }],
      m,
    );
    expect(rows[0]).toEqual([
      'Student ID', 'Student', 'Email',
      'Essay (assignment) - earned', 'Essay (assignment) - possible', 'Essay (assignment) - status',
      'Quiz (quiz) - earned', 'Quiz (quiz) - possible', 'Quiz (quiz) - status',
      'Total earned', 'Total possible (graded items)', 'Total %',
    ]);
    expect(rows[1]).toEqual(['s1', '=Evil, Name', '', 0, 100, 'graded', undefined, 10, 'missing', 0, 100, 0]);
    const csv = toCsv(rows);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')[1]).toBe(`s1,"'=Evil, Name",,0,100,graded,,10,missing,0,100,0`);
  });
});
