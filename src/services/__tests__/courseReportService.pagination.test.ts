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
  expect(h.db.calls.filter(c => c.table === 'assignments').map(c => c.range)).toEqual([[0, 999], [1000, 1999]]);
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
