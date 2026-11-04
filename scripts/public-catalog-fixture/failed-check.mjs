// ABOUTME: Names a failed net fixture teardown check for the sanitized summary. Playwright's JSON reporter drops test.step steps
// ABOUTME: made in fixture teardown, so the fixed check title is recorded as a test annotation instead, then the error rethrown.
import { STEP_RE } from './pw-summary.mjs';

export const FAILED_CHECK_TYPE = 'pc_failed_check';

/** Runs one teardown check. On failure: annotate {type: pc_failed_check, description: <fixed title>} and rethrow the SAME
 *  error. Only allowlisted net_* titles are accepted (an unlisted title throws before the check runs). Never a message. */
export async function check(testInfo, title, fn) {
  if (!/^net_/.test(title) || !STEP_RE.test(title)) throw new Error(`PUBLIC_CATALOG_E_CHECK_TITLE ${title}`);
  try {
    await fn();
  } catch (e) {
    testInfo.annotations.push({ type: FAILED_CHECK_TYPE, description: title });
    throw e;
  }
}
