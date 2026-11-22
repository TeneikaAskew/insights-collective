import { expect, it, vi } from 'vitest';
import { buildGradebook, buildGradebookCsvRows, gradebookCellKey } from '../gradebookData';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { computeCourseReport } from '@/services/courseReportService';

it.each(['pending_review', 'complete'])('uses finalized grades in totals while retaining %s cell evidence', (state) => {
  const students = [{ id: 's1', full_name: 'Ada' }];
  const assignments = [{ id: 'a1', title: 'Essay', points: 100 }];
  const quizzes = [{ id: 'q1', title: 'Quiz', points: 10 }];
  const assignmentSubmissions = [{ id: 'as', user_id: 's1', assignment_id: 'a1', grade: 80, workflow_state: 'graded' }];
  const quizSubmissions = [{ id: 'qs', user_id: 's1', quiz_id: 'q1', score: 5, workflow_state: state }];
  const input = { students, assignments, quizzes, assignmentSubmissions, quizSubmissions };
  const before = structuredClone(input);
  const model = buildGradebook(input);
  const pending = state === 'pending_review';
  expect(model.cells[gradebookCellKey('s1', 'quiz', 'q1')]).toMatchObject({ pointsEarned: 5, percentage: 50, status: pending ? 'submitted' : 'graded' });
  expect(model.totals.s1).toEqual(pending
    ? { earned: 80, possible: 100, percentage: 80, gradedCount: 1 }
    : { earned: 85, possible: 110, percentage: 85 / 110 * 100, gradedCount: 2 });
  const report = computeCourseReport({
    learners: [{ userId: 's1', name: 'Ada', avatarUrl: null, enrolledAt: '2026-01-01', completedItems: 0, totalItems: 1, progress: 0, needsAttention: false }],
    modules: [], items: [], progressions: [], assignments, quizzes, assignmentSubmissions, quizSubmissions,
  });
  expect(report.work).toEqual({ graded: pending ? 1 : 2, awaitingGrading: pending ? 1 : 0, notSubmitted: 0, total: 2 });
  const rows = buildGradebookCsvRows(students, [{ ...assignments[0], type: 'assignment' }, { ...quizzes[0], type: 'quiz' }], model);
  expect(rows[1]).toEqual(['s1', 'Ada', '', 80, 100, 'graded', 5, 10, pending ? 'submitted' : 'graded', pending ? 80 : 85, pending ? 100 : 110, pending ? 80 : 77.27]);
  expect(input).toEqual(before);
});
