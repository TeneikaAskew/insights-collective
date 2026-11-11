// ABOUTME: The frozen E1 test.step titles and the ONE public-safe classifier of a failed E1 result: it reads only step
// ABOUTME: titles, nesting and whether a step carries an error. Messages, stacks, values and locations are never read.
//
// Used by the job's summary (scripts/e2e/le-e1-summary.mjs, composed by the shared lane) to print
// "LE-E1 failed step: <code>" where <code> is one of E1_STEPS or "unknown". Import-free.

/** E1's phases, in the order the spec runs them. A title outside this list is never printed. */
export const E1_STEPS = Object.freeze([
  'E1_OPEN', 'E1_BASELINE', 'E1_EDIT_TITLE', 'E1_EDIT_BODY', 'E1_SAVED', 'E1_SETTLE',
  'E1_ROW', 'E1_BODY', 'E1_RELOAD', 'E1_RELOAD_BODY', 'E1_EVIDENCE',
]);
const LISTED = new Set(E1_STEPS);

/**
 * failedStep(result): result is ONE attempt from the Playwright JSON report (tests[].results[n]).
 * Returns a listed code or 'unknown'; never anything taken from a message.
 *   1. The deepest LISTED step that carries an error (an `error` object or a non-empty `errors` array).
 *   2. Otherwise, ONLY for a timedOut attempt (a timeout can end a step without an error on it): the LAST listed top-level
 *      step recorded, meaning "the last phase reached before the timeout".
 *   3. Otherwise 'unknown' (no steps, none listed, or a failure outside every listed step such as a fixture teardown).
 * A passed attempt has no failed step: 'none'.
 */
export function failedStep(result) {
  if (!result || typeof result !== 'object') return 'unknown';
  if (result.status === 'passed') return 'none';
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const hasError = (s) => (s && typeof s.error === 'object' && s.error !== null) || (Array.isArray(s?.errors) && s.errors.length > 0);
  let deepest = null;
  const walk = (list, depth) => {
    for (const s of list) {
      if (!s || typeof s !== 'object') continue;
      const title = typeof s.title === 'string' ? s.title : '';
      if (LISTED.has(title) && hasError(s) && (!deepest || depth >= deepest.depth)) deepest = { title, depth };
      if (Array.isArray(s.steps)) walk(s.steps, depth + 1);
    }
  };
  walk(steps, 0);
  if (deepest) return deepest.title;
  if (result.status !== 'timedOut') return 'unknown';
  const top = steps.map((s) => (typeof s?.title === 'string' ? s.title : '')).filter((t) => LISTED.has(t));
  return top.length ? top[top.length - 1] : 'unknown';
}
