// ABOUTME: The scoring rules for STAR evaluations — the scale, and what
// ABOUTME: disqualifies an evaluation entirely. Nothing here repairs a score.
// ABOUTME: Kept out of index.ts so it can be tested without booting the server.

// The assessment rubric in `assesment_rubric` only defines levels 1-5 (Concern
// through Strength), so 5 is the scale this feature actually reasons on. Both
// question types score on it; nothing is doubled for display any more.
export const SCORE_SCALE = 5;

const COMPONENTS = ["situation", "task", "action", "result"] as const;
type Component = typeof COMPONENTS[number];

export interface StarScores {
  situation: number;
  task: number;
  action: number;
  result: number;
  overall: number;
}

export type ScoreResult =
  | { ok: true; scores: StarScores }
  | { ok: false; reasons: string[] };

/**
 * Accept a component score, or return null.
 *
 * This used to clamp: a 9 became a 5, "4" became 4, 8.2 rounded to 8. All of
 * that was compensating for a prompt that merely *asked* for 1-5. The request is
 * now a `json_schema` response format whose integer bound the decoder enforces —
 * proven by instructing the model to emit 9s and getting 5s back, and by setting
 * the bound to 3 and getting 3s — so a value outside the scale is no longer the
 * model being sloppy. It means the constraint did not hold, and quietly turning
 * it into a 5 would hide that from everyone.
 *
 * Strictly an integer in range: `strict: true` cannot produce a quoted "4" or a
 * fractional 3.5 either, so accepting them would be accepting a broken contract.
 */
export function assertScore(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > SCORE_SCALE) return null;
  return value;
}

/** What went wrong, in words, so a log line names the field and the value. */
function violation(field: Component, value: unknown): string {
  if (value === undefined) return `${field} was missing`;
  if (typeof value !== "number") {
    return `${field} was ${JSON.stringify(value)} (${typeof value}), not a number`;
  }
  if (!Number.isInteger(value)) return `${field} was ${value}, not a whole number`;
  return `${field} was ${value}, outside 1-${SCORE_SCALE}`;
}

/**
 * Validate a model's `scores` object.
 *
 * Every violation is collected rather than short-circuiting on the first, so one
 * log line describes the whole payload instead of leading to a fix-and-rerun
 * loop. The overall is recomputed rather than read: both prompts define it as
 * the average of the four components, and asking the model for a number the
 * server then discards is how the stored `8.2` came to sit beside a 9, 7, 8, 8.
 *
 * The overall is the EXACT mean, not rounded. Rounding hid the one distinction
 * the calibration ladder fought hardest for: an excellent-but-mechanical answer
 * scoring 5,5,4,5 rounded up to the same 5/5 as a flawless one. Four integers
 * averaged can only produce .0, .25, .5 or .75, all exact in floating point, so
 * there is nothing to round away.
 */
export function normalizeScores(raw: unknown): ScoreResult {
  const scores = (raw ?? {}) as Record<string, unknown>;

  const accepted: Partial<Record<Component, number>> = {};
  const reasons: string[] = [];

  for (const field of COMPONENTS) {
    const score = assertScore(scores[field]);
    if (score === null) {
      reasons.push(violation(field, scores[field]));
    } else {
      accepted[field] = score;
    }
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const { situation, task, action, result } = accepted as Record<Component, number>;
  return {
    ok: true,
    scores: {
      situation,
      task,
      action,
      result,
      overall: (situation + task + action + result) / 4,
    },
  };
}
