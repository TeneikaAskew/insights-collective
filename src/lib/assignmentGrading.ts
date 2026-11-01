// ABOUTME: The current assignment grading contract in one place: public.assignments.points is the denominator and
// ABOUTME: assignment_submissions.grade is the instructor-authored value; a grade save counts only when read back.

const finite = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

/**
 * Points possible for an assignment row. The table's column is `points` (20250714215052 created it; every later
 * `points_possible` definition is a no-op CREATE TABLE IF NOT EXISTS or belongs to quizzes/rubrics). Raw
 * `assignments(*)` embeds therefore carry `points` only. `points_possible` is read solely as a legacy alias for
 * callers that already aliased it, and never wins over `points`. Returns null when neither is set.
 */
export function assignmentPointsPossible(a: { points?: unknown; points_possible?: unknown } | null | undefined): number | null {
  if (!a) return null;
  return finite(a.points) ?? finite(a.points_possible) ?? null;
}

/**
 * The learner-visible earned points for an assignment submission. `grade` is what both instructor writers save;
 * `score` is a separate, older nullable column that is kept and shown only when no grade exists (the same
 * precedence CourseDetail already uses). 0 is a real grade.
 */
export function submissionEarnedPoints(s: { grade?: unknown; score?: unknown } | null | undefined): number | null {
  if (!s) return null;
  return finite(s.grade) ?? finite(s.score) ?? null;
}

export interface SavedGradeRow { id: string; grade: number | null; workflow_state?: string | null }

/**
 * A grade save succeeded only if exactly one row came back with the grade that was sent. PostgREST reports an
 * RLS-filtered update as success with zero rows, and the pin_assignment_grade_columns trigger silently reverts grade
 * columns for non-staff, returning the row with the OLD grade. Both must surface as a failure, not "published".
 */
export function assertGradeSaved(rows: SavedGradeRow[] | null | undefined, submissionId: string, grade: number): SavedGradeRow {
  const list = rows ?? [];
  if (list.length !== 1 || list[0].id !== submissionId) {
    throw new Error('Grade was not saved: the submission was not updated (no permission, or it no longer exists).');
  }
  if (finite(list[0].grade) !== grade) {
    throw new Error('Grade was not saved: the stored grade did not change (grading permission is required).');
  }
  return list[0];
}
