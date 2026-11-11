// ABOUTME: Pure arithmetic for the F2 timer oracle: does a shown "time left" match the SERVER's started_at, and is the
// ABOUTME: elapsed time large enough that a timer reset at reload could not pass within the tolerance?
export const TIMER_TOLERANCE_S = 3;     // shown vs server-derived, both rounded to whole seconds by the UI tick
export const TIMER_TICK_MARGIN_S = 1;   // one UI tick
/** Minimum server elapsed before the comparison is meaningful: a reset must miss by more than tolerance + tick. */
export const TIMER_MIN_ELAPSED_S = 10;
if (TIMER_MIN_ELAPSED_S <= TIMER_TOLERANCE_S + TIMER_TICK_MARGIN_S) throw new Error('timer oracle constants are not separating');

/** Seconds left that the server's started_at implies at `nowMs`. */
export function serverSecondsLeft(startedAtMs, nowMs, limitMinutes) {
  return limitMinutes * 60 - (nowMs - startedAtMs) / 1000;
}
/** True when `shownS` equals the server-derived time left within the tolerance. */
export function timerMatchesServer(shownS, startedAtMs, nowMs, limitMinutes, tol = TIMER_TOLERANCE_S) {
  return Math.abs(shownS - serverSecondsLeft(startedAtMs, nowMs, limitMinutes)) <= tol;
}
/** PostgreSQL timestamptz text ("2026-11-01 16:20:01.123+00") to epoch ms. */
export function pgTime(t) {
  const ms = Date.parse(String(t).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  if (!Number.isFinite(ms)) throw new Error('unparseable timestamptz');
  return ms;
}
