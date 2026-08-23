// ABOUTME: The scoring rules for STAR evaluations — the scale, what the model is
// ABOUTME: allowed to get wrong, and what disqualifies an evaluation entirely.
// ABOUTME: Kept out of index.ts so it can be tested without booting the server.

// The assessment rubric in `assesment_rubric` only defines levels 1-5 (Concern
// through Strength), so 5 is the scale this feature actually reasons on. Both
// question types score on it; nothing is doubled for display any more.
export const SCORE_SCALE = 5;

export interface StarScores {
  situation: number;
  task: number;
  action: number;
  result: number;
  overall: number;
}

/**
 * A component the model put outside the scale is a repairable mistake — it has
 * returned a 9 and an 8.2 — and since the UI draws each score as a percentage of
 * the scale, an out-of-range value renders as an over-full bar. Clamping keeps
 * the ranking the model intended.
 *
 * A component that is absent or unparseable is NOT repairable. Defaulting it to
 * the bottom of the scale would tell the user their answer scored the worst
 * possible when in fact the model malformed its output, so this returns null and
 * the caller rejects the whole evaluation instead of inventing a score.
 */
export function clampScore(value: unknown): number | null {
  // Only a number, or a string that parses as one — models do quote their
  // numbers. Everything else is rejected by type rather than by coercion,
  // because Number() turns [], true and "  " into finite numbers (0, 1, 0),
  // which would score a malformed payload instead of refusing it.
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(num)) return null;
  return Math.min(SCORE_SCALE, Math.max(1, Math.round(num)));
}

/**
 * Normalise a model's `scores` object, or return null if it cannot be trusted.
 *
 * The overall is always recomputed rather than taken from the model: both
 * prompts ask for the average of the four components, and the model has
 * disagreed with its own arithmetic (an 8.2 next to a 9, 7, 8, 8).
 */
export function normalizeScores(raw: unknown): StarScores | null {
  const scores = (raw ?? {}) as Record<string, unknown>;
  const situation = clampScore(scores.situation);
  const task = clampScore(scores.task);
  const action = clampScore(scores.action);
  const result = clampScore(scores.result);

  // The page renders every component and the overall unconditionally, so a
  // payload missing any of them is not partially usable — it is a failed
  // evaluation, in the same class as feedback with no strengths.
  if (situation === null || task === null || action === null || result === null) {
    return null;
  }

  return {
    situation,
    task,
    action,
    result,
    overall: Math.round((situation + task + action + result) / 4),
  };
}
