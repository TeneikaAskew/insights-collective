import { describe, it, expect, vi } from 'vitest';
import { makeFakeClient, makeFakeDb, type FakeDb } from './fakeRosterSupabase';
const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => makeFakeClient(h.db).from(t) } }));
import { fetchGradebookStudents, fetchGradebookAssignments, fetchGradebookQuizzes, fetchGradebookAssignmentSubmissions, fetchGradebookQuizSubmissions } from '../courseGradebookService';
import { buildGradebook, buildGradebookCsvRows, gradebookCellKey } from '@/components/course/gradebook/gradebookData';
import { fetchCourseReport } from '../courseReportService';
import { ID_CHUNK } from '../courseRosterService';
function fixture(cap = 1) {
  h.db = makeFakeDb({ enrollments: [], profiles: [], assignments: [], quizzes: [], assignment_submissions: [], quiz_submissions: [] });
  h.db.rowCap = cap;
  for (let i = 0; i < 3; i++) {
    h.db.tables.enrollments.push({ id: `e${i}`, user_id: `s${i}`, course_id: 'c' });
    h.db.tables.profiles.push({ id: `s${i}`, first_name: `Synthetic${i}` });
    h.db.tables.assignments.push({ id: `a${i}`, course_id: 'c', points: 10, due_date: '2026-01-01' });
    h.db.tables.quizzes.push({ id: `q${i}`, 'content_items.course_id': 'c', points_possible: 10, created_at: '2026-01-01' });
    h.db.tables.assignment_submissions.push({ id: `as${i}`, user_id: 's0', assignment_id: `a${i}`, grade: 2, workflow_state: 'graded' });
    h.db.tables.quiz_submissions.push({ id: `qs${i}`, user_id: 's0', quiz_id: `q${i}`, score: [8, 0, 4][i], kept_score: i === 1 ? 0 : null, workflow_state: i === 2 ? 'pending_review' : 'complete', attempt: 1 });
  }
  // Deliberately reverse tied rows; stable ID ordering must recover them.
  for (const rows of Object.values(h.db.tables)) rows.reverse();
}
describe('complete Gradebook reads', () => {
  it.each([1, 2, 3])('preserves zero/provisional cells and CSV beyond cap %s, agreeing with Reports counts', async cap => {
    fixture(cap); const before = structuredClone(h.db.tables);
    const students = await fetchGradebookStudents('c');
    const assignments = await fetchGradebookAssignments('c');
    const quizzes = (await fetchGradebookQuizzes('c')).map(q => ({ ...q, points: q.points_possible }));
    const assignmentSubmissions = await fetchGradebookAssignmentSubmissions(assignments.map(a => a.id));
    const quizSubmissions = await fetchGradebookQuizSubmissions(quizzes.map(q => q.id));
    expect(students.map(s => s.id)).toEqual(['s0', 's1', 's2']);
    expect(quizzes.map(q => q.id)).toEqual(['q0', 'q1', 'q2']);
    expect(assignments.map(a => a.id)).toEqual(['a0', 'a1', 'a2']);
    const m = buildGradebook({ students, assignments, quizzes, assignmentSubmissions, quizSubmissions });
    expect(m.cells[gradebookCellKey('s0', 'quiz', 'q1')]).toMatchObject({ pointsEarned: 0, status: 'graded' });
    expect(m.cells[gradebookCellKey('s0', 'quiz', 'q2')]).toMatchObject({ pointsEarned: 4, status: 'submitted' });
    expect(m.totals.s0).toMatchObject({ earned: 14, possible: 50, gradedCount: 5 });
    const csv = buildGradebookCsvRows(students, quizzes.map(q => ({ ...q, type: 'quiz' as const })), m);
    expect(csv[1].slice(6, 12)).toEqual([0, 10, 'graded', 4, 10, 'submitted']);
    for (const table of Object.keys(before)) expect(h.db.calls.filter(c => c.table === table).at(-1)?.range?.[0]).toBe(3);
    const report = await fetchCourseReport('c');
    expect(report.work).toEqual({ graded: 5, awaitingGrading: 1, notSubmitted: 12, total: 18 });
    expect(h.db.tables).toEqual(before);
  });
  const loads = [
    ['enrollments', () => fetchGradebookStudents('c')], ['profiles', () => fetchGradebookStudents('c')],
    ['assignments', () => fetchGradebookAssignments('c')], ['quizzes', () => fetchGradebookQuizzes('c')],
    ['assignment_submissions', () => fetchGradebookAssignmentSubmissions(['a0','a1','a2'])],
    ['quiz_submissions', () => fetchGradebookQuizSubmissions(['q0','q1','q2'])],
  ] as const;
  it.each(loads)('rejects terminal %s errors instead of returning partial rows', async (table, load) => {
    fixture(); h.db.failWhen = (t, _n, range) => t === table && range?.[0] === 3 ? 'terminal refusal' : undefined;
    await expect(load()).rejects.toThrow('terminal refusal');
  });
  it('chunks large ID filters, preserves scope, and avoids empty submission reads', async () => {
    fixture(); const ids = Array.from({ length: ID_CHUNK + 1 }, (_, i) => `q${i}`);
    h.db.tables.quiz_submissions.push({ id: 'foreign', quiz_id: 'outside', user_id: 's0' });
    const rows = await fetchGradebookQuizSubmissions(ids);
    expect(rows).toHaveLength(3); expect(rows.some(r => r.id === 'foreign')).toBe(false);
    expect(h.db.calls.every(c => c.inSizes.every(n => n <= ID_CHUNK))).toBe(true);
    expect(h.db.calls.some(c => c.inSizes.includes(1))).toBe(true);
    h.db.calls = []; expect(await fetchGradebookQuizSubmissions([])).toEqual([]); expect(h.db.calls).toEqual([]);
    expect(await fetchGradebookStudents('other')).toEqual([]); expect(await fetchGradebookAssignments('other')).toEqual([]); expect(await fetchGradebookQuizzes('other')).toEqual([]);
  });
});
