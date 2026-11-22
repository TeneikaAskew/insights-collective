import { expect, it, vi } from 'vitest';
import { makeFakeClient, makeFakeDb, type FakeDb } from './fakeRosterSupabase';
const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => makeFakeClient(h.db).from(t) } }));
import { fetchCourseReport } from '../courseReportService';
function fixture() {
  return makeFakeDb({ enrollments: [{ course_id: 'c1', user_id: 'u1', enrolled_at: '2026-01-01' }], profiles: [], modules: [], assignments: [], quizzes: [] });
}
it('reads all assessments and bounded submission chunks beyond the row cap', async () => {
  h.db = fixture();
  h.db.tables.assignments = Array.from({ length: 1001 }, (_, i) => ({ id: `a${String(i).padStart(4, '0')}`, course_id: 'c1', points: 10 }));
  h.db.tables.assignment_submissions = h.db.tables.assignments.map((a, i) => ({ id: `s${i}`, assignment_id: a.id, user_id: 'u1', grade: 8, workflow_state: 'graded' }));
  h.db.tables.assignments.push({ id: 'foreign', course_id: 'c2', points: 10 });
  const before = structuredClone(h.db.tables);
  const report = await fetchCourseReport('c1');
  expect(report.work).toEqual({ graded: 1001, awaitingGrading: 0, notSubmitted: 0, total: 1001 });
  expect(h.db.calls.filter(c => c.table === 'assignments').map(c => c.range)).toEqual([[0, 999], [1000, 1999], [1001, 2000]]);
  expect(h.db.calls.filter(c => c.table === 'assignment_submissions').every(c => c.inSizes.every(n => n <= 200))).toBe(true);
  expect(h.db.tables).toEqual(before);
});
it('includes the scored quiz attempt beyond the first submissions page', async () => {
  h.db = fixture();
  h.db.tables.quizzes = [{ id: 'q1', 'content_items.course_id': 'c1', points_possible: 10 }];
  h.db.tables.quiz_submissions = Array.from({ length: 1001 }, (_, i) => ({ id: `s${String(i).padStart(4, '0')}`, quiz_id: 'q1', user_id: 'u1', attempt: i + 1, score: i === 1000 ? 0 : null, workflow_state: i === 1000 ? 'complete' : 'untaken' }));
  expect((await fetchCourseReport('c1')).work).toEqual({ graded: 1, awaitingGrading: 0, notSubmitted: 0, total: 1 });
});
it.each(['assignments', 'quiz_submissions'])('rejects a late %s page error', async (table) => {
  h.db = fixture();
  h.db.tables.assignments = Array.from({ length: 1001 }, (_, i) => ({ id: `a${i}`, course_id: 'c1', points: 10 }));
  h.db.tables.quizzes = [{ id: 'q1', 'content_items.course_id': 'c1', points_possible: 10 }];
  h.db.tables.quiz_submissions = Array.from({ length: 1001 }, (_, i) => ({ id: `s${i}`, quiz_id: 'q1', user_id: 'u1', attempt: i, score: 0 }));
  h.db.failWhen = (name, _nth, range) => name === table && range?.[0] === 1000 ? 'late page failed' : undefined;
  await expect(fetchCourseReport('c1')).rejects.toThrow('late page failed');
});

it.each([1, 2, 3, 4])('reads complete filtered assessments/submissions with server cap %s', async (cap) => {
  h.db = fixture(); h.db.rowCap = cap;
  h.db.tables.assignments = Array.from({length: 6}, (_, i) => ({id: `a${i}`, course_id: 'c1', points: 10})).reverse();
  h.db.tables.quizzes = Array.from({length: 6}, (_, i) => ({id: `q${i}`, 'content_items.course_id': 'c1', points_possible: 10})).reverse();
  h.db.tables.assignment_submissions = h.db.tables.assignments.map(a => ({id: `s${a.id}`, assignment_id: a.id, user_id: 'u1', grade: 0, workflow_state: 'graded'}));
  h.db.tables.quiz_submissions = h.db.tables.quizzes.map(q => ({id: `s${q.id}`, quiz_id: q.id, user_id: 'u1', score: 0, workflow_state: 'complete'}));
  h.db.tables.assignments.push({id: 'foreign', course_id: 'c2', points: 10});
  h.db.tables.assignment_submissions.push({id: 'foreign', assignment_id: 'foreign', user_id: 'u1', grade: 9});
  const before = structuredClone(h.db.tables);
  expect((await fetchCourseReport('c1')).work).toEqual({total: 12, graded: 12, awaitingGrading: 0, notSubmitted: 0});
  for (const table of ['assignments', 'quizzes', 'assignment_submissions', 'quiz_submissions']) {
    expect(h.db.calls.filter(c => c.table === table).map(c => c.range?.[0])).toEqual(Array.from({length: Math.ceil(6 / cap) + 1}, (_, i) => Math.min(i * cap, 6)));
  }
  expect(h.db.tables).toEqual(before);
});
it.each(['assignments','quizzes','assignment_submissions','quiz_submissions'])('rejects terminal error after a capped positive %s page', async table => {
  h.db = fixture(); h.db.rowCap = 1;
  h.db.tables.assignments = [{id: 'a', course_id: 'c1', points: 10}];
  h.db.tables.quizzes = [{id: 'q', 'content_items.course_id': 'c1', points_possible: 10}];
  h.db.tables.assignment_submissions = [{id: 's', assignment_id: 'a', user_id: 'u1', grade: 0}];
  h.db.tables.quiz_submissions = [{id: 's', quiz_id: 'q', user_id: 'u1', score: 0}];
  h.db.failWhen = (name, _n, range) => name === table && range?.[0] === 1 ? 'capped terminal failure' : undefined;
  await expect(fetchCourseReport('c1')).rejects.toThrow('capped terminal failure');
});
