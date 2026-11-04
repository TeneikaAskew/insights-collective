// ABOUTME: Client-side reading of the quiz attempt contract enforced by start_quiz_attempt and
// ABOUTME: finalize_quiz_submission. Display and routing only: the server remains the authority.

/** The fields of a quiz_submissions row the attempt rules depend on. */
export interface AttemptRow {
  attempt: number | null;
  workflow_state: string | null;
  finished_at?: string | null;
}

/**
 * NULL or 0 means unlimited. Matches start_quiz_attempt
 * (`v_allowed IS NOT NULL AND v_allowed > 0`), finalize_quiz_submission and
 * get_quiz_questions_for_taking.
 */
export function isUnlimitedAttempts(allowed: number | null | undefined): boolean {
  return allowed == null || allowed <= 0;
}

/**
 * An attempt is still being taken until score-quiz finalizes it. A freshly
 * started attempt is created by start_quiz_attempt in workflow_state
 * 'pending_review' with no finished_at; finalize sets 'complete' + finished_at.
 */
export function isAttemptInProgress(row: AttemptRow | null | undefined): boolean {
  return !!row && row.workflow_state !== 'complete' && !row.finished_at;
}

/**
 * Whether starting ANOTHER attempt is allowed, given the learner's latest one.
 * Continuing an in-progress attempt is a different question and is never
 * blocked by the limit here: that attempt already exists.
 */
export function canStartNewAttempt(
  latest: AttemptRow | null | undefined,
  allowed: number | null | undefined,
): boolean {
  if (isAttemptInProgress(latest)) return false;
  if (isUnlimitedAttempts(allowed)) return true;
  return (latest?.attempt ?? 0) < (allowed as number);
}

/** Attempts left after the latest one, or null when unlimited. */
export function attemptsRemaining(
  latest: AttemptRow | null | undefined,
  allowed: number | null | undefined,
): number | null {
  if (isUnlimitedAttempts(allowed)) return null;
  return Math.max(0, (allowed as number) - (latest?.attempt ?? 0));
}

/**
 * Seconds left on a timed attempt, measured from the server's started_at so a
 * reload resumes the clock instead of resetting it. Null when untimed or when
 * started_at is missing or unparseable.
 */
export function secondsRemaining(
  startedAt: string | null | undefined,
  timeLimitMinutes: number | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!timeLimitMinutes || timeLimitMinutes <= 0 || !startedAt) return null;
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  return Math.max(0, timeLimitMinutes * 60 - elapsed);
}
