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

/**
 * assignment_submissions.grade is numeric(10,2): Postgres rounds the DECIMAL value to two places, ties away from
 * zero (7.125 -> 7.13, 10.075 -> 10.08), and returns the rounded value. Round the same way before writing so the
 * readback compares like with like. The scaling is done on the number's shortest decimal form ("10.075e2" is
 * exactly 1007.5), not on its binary value (10.075 * 100 is 1007.4999999999999, which would round down).
 */
export function toStoredGrade(value: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (abs < 0.005) return 0; // also covers exponent forms like 1e-7, which cannot be scaled as text
  const text = String(abs);
  if (text.includes('e')) return value; // >= 1e21: far beyond the column and already integral
  const scaled = Math.round(Number(`${text}e2`));
  return (sign * Number(`${scaled}e-2`)) || 0;
}

/**
 * A grade typed by an instructor. The range is checked on the value as typed, so -0.004 or 10.004 on a 10-point
 * assignment is refused rather than rounded into range; only an accepted value is normalized to storage scale.
 */
export function parseGradeInput(raw: string, pointsPossible: number): { ok: true; value: number } | { ok: false } {
  const text = raw.trim();
  if (text === '') return { ok: false };
  const typed = Number(text);
  if (!Number.isFinite(typed) || typed < 0 || typed > pointsPossible) return { ok: false };
  return { ok: true, value: toStoredGrade(typed) };
}

export interface SavedGradeRow { id: string; grade: number | null; workflow_state?: string | null; [k: string]: unknown }

const sameValue = (key: string, got: unknown, want: unknown): boolean => {
  if (want === null || want === undefined) return got === null || got === undefined;
  if (typeof want === 'number') return finite(got) === want;
  // timestamptz comes back re-formatted (e.g. +00:00 instead of Z); compare the instant, not the text.
  if (key.endsWith('_at') && typeof want === 'string') {
    const a = Date.parse(String(got)); const b = Date.parse(want);
    return Number.isFinite(a) && a === b;
  }
  return got === want;
};

/**
 * A grade save succeeded only if exactly one row came back carrying EVERY field that was written. PostgREST reports
 * an RLS-filtered update as success with zero rows, and the pin_assignment_grade_columns trigger silently keeps the
 * OLD grade, grader_comments and graded_at for non-staff while letting workflow_state through. Checking the grade
 * alone accepted a same-grade save whose feedback was reverted, and a matching grade left in a non-graded state.
 * A legitimate same-value re-save still passes: staff writes persist every field, including the new graded_at.
 *
 * This is a persisted-state check only. The update filters on id alone, so it is not optimistic concurrency and does
 * not make a save safe against a newer attempt or a concurrent grader.
 */
export function assertGradeSaved(
  rows: SavedGradeRow[] | null | undefined,
  submissionId: string,
  written: Record<string, unknown>,
): SavedGradeRow {
  const list = rows ?? [];
  if (list.length !== 1 || list[0].id !== submissionId) {
    throw new Error('Grade was not saved: the submission was not updated (no permission, or it no longer exists).');
  }
  const mismatched = Object.keys(written).filter((k) => !sameValue(k, list[0][k], written[k]));
  if (mismatched.length > 0) {
    throw new Error(`Grade was not saved: the stored ${mismatched.join(', ')} did not take the new value (grading permission is required).`);
  }
  return list[0];
}
