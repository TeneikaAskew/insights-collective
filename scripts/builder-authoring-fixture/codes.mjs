// ABOUTME: Finite maps for every public value the builder-authoring lane prints (stage, error class, statuses, child refusal
// ABOUTME: codes, summary reasons) plus the reused-module blob pins. Lookup is own-key only on null-prototype frozen maps.
//
// A printed value is always a map VALUE written in this file, never the input that selected it: an input that is not an
// own key of the map prints the map's fixed fallback. No regex sanitizing of input reaches an output.

const map = (keys) => Object.freeze(Object.assign(Object.create(null), Object.fromEntries(keys.map((k) => [k, k]))));

/** The map's own value for `key`, else `fallback`. Inherited keys (__proto__, constructor, toString) never match. */
export function pick(m, key, fallback) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(m, key) ? m[key] : fallback;
}

/** Every `test.step` title the specs use (the failure stage). */
export const STAGES = map(['before_state', 'ui_reorder', 'db_settled', 'after_reload', 'screenshot', 'ui_create', 'rendered',
  'ui_delete', 'db_readback', 'out_of_band_delete', 'ui_delete_refused']);
export const STAGE_UNLISTED = 'unlisted';

/** Every own error code a spec or helper throws inside a test (the error class). */
export const TEST_ERRORS = map(['BA_E_NO_SESSION', 'BA_E_READ_MODULES', 'BA_E_READ_CONTENT_ITEMS', 'BA_E_NO_RUN_DIR', 'BA_E_PROJECT',
  'BA_E_CREATED_RECORD', 'BA_R2_E_LAYOUT', 'BA_SHOT_E_NAME', 'BA_SHOT_E_EXCLUSIVE_CREATE', 'BA_SHOT_E_WRITE']);
export const ERROR_UNLISTED = 'unlisted';

/** Playwright test.status and result.status values. */
export const TEST_STATUS = map(['expected', 'unexpected', 'flaky', 'skipped']);
export const RESULT_STATUS = map(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
export const STATUS_OTHER = 'other';

/** Child refusal codes run.sh may print after its own code. ba-db and ba-shots: all of their constants. The pairing
 *  producer (#162, unchanged): its literal codes; its dynamic RUN_E_D1_SO_* and any suffixed code print UNLISTED. */
export const CHILD_CODES = map([
  'BA_DB_E_PSQL', 'BA_DB_E_PROOF', 'BA_DB_E_SCRIPT', 'BA_DB_E_SEED', 'BA_DB_E_NONCE', 'BA_DB_E_PRIVATE_DIR', 'BA_DB_E_OUT_NOT_PRIVATE',
  'BA_DB_E_OUT_WRITE', 'BA_DB_E_USAGE', 'BA_DB_E_UNCLASSIFIED',
  'BA_SHOT_E_DIR', 'BA_SHOT_E_PROOF', 'BA_SHOT_E_EXPORT_DIR', 'BA_SHOT_E_UNKNOWN_FILE', 'BA_SHOT_E_UNPAIRED', 'BA_SHOT_E_WITHHELD_RECORD',
  'BA_SHOT_E_READ', 'BA_SHOT_E_SCAN_RECORD', 'BA_SHOT_E_SCAN_MISMATCH', 'BA_SHOT_E_PNG', 'BA_SHOT_E_NONCE_IN_PNG', 'BA_SHOT_E_EXPORT_WRITE',
  'BA_SHOT_E_USAGE', 'BA_SHOT_E_UNCLASSIFIED',
  'PAIR_E_API_UNCLASSIFIED', 'PAIR_E_API_CONTROL_ID', 'PAIR_E_API_COUNT', 'PAIR_E_API_MISMATCH', 'PAIR_E_API_NOT_FILTERING',
  'PAIR_E_API_PARSE', 'PAIR_E_API_SHAPE', 'PAIR_E_API_STATUS', 'PAIR_E_API_TRANSPORT', 'PAIR_E_DB_MISMATCH', 'PAIR_E_INSERT',
  'PAIR_E_NONCE', 'PAIR_E_PRECHECK', 'PAIR_E_PSQL', 'PAIR_E_SCRIPT', 'PAIR_E_SEED', 'PAIR_E_UNCLASSIFIED', 'PAIR_E_USAGE',
  'PAIR_E_USED_STACK', 'RUN_E_APP_UNVERIFIED', 'RUN_E_APP_VERIFIER', 'RUN_E_APP_VERIFIER_PIN', 'RUN_E_D1_API_ORIGIN', 'RUN_E_D1_APP_ORIGIN',
  'RUN_E_D1_BOOTSTRAP_FILE', 'RUN_E_D1_BOOTSTRAP_MISMATCH', 'RUN_E_D1_BOOTSTRAP_UNPINNED', 'RUN_E_D1_HANDLE_CHANGED', 'RUN_E_D1_HANDLE_CLOSE',
  'RUN_E_D1_HANDLE_GROWTH', 'RUN_E_D1_HANDLE_OPEN', 'RUN_E_D1_HANDLE_PARSE', 'RUN_E_D1_HANDLE_READ', 'RUN_E_D1_HANDLE_SIZE',
  'RUN_E_D1_HANDLE_STAT', 'RUN_E_D1_HANDLE_TYPE', 'RUN_E_D1_LIVE_READ', 'RUN_E_D1_MODE_EXACT', 'RUN_E_D1_MODULE', 'RUN_E_D1_NO_ATTEMPT',
]);
export const CHILD_NONE = 'NONE';
export const CHILD_UNLISTED = 'UNLISTED';
/** The only producers whose refusal line run.sh reads, by their own fixed prefix. */
export const CHILD_PREFIXES = Object.freeze(['run-journey refused: ', 'ba-db refused: ', 'ba-shots refused: ']);

/** Every SummaryError code summary.mjs raises. */
export const SUMMARY_REASONS = map(['open', 'type', 'links', 'mode', 'size', 'growth', 'read', 'report_shape', 'report_parse', 'exit',
  'witness_duplicate', 'witness_line', 'witness_incomplete', 'run_dir', 'usage', 'grammar']);
export const SUMMARY_UNCLASSIFIED = 'unclassified';

/** Reused #162 modules (head 77beaefe), pinned by git blob id: capture (shot-core), export (shot-export), private
 *  (private-dir, private-psql), observation, pairing and binding. run.sh refuses before any write if one differs. */
export const REUSED_PINS = Object.freeze(Object.assign(Object.create(null), {
  'e2e/gradebook-roles/local-binding.mjs': 'e0b966ffa258374b228f735baecc2b6377bddeb0',
  'e2e/gradebook-roles/origin-guard.mjs': '25332b129959bbae5d020c439e56b0cbbae46510',
  'e2e/gradebook-roles/journey/private-dir.mjs': '030a386937b431c2af44209e070164750cdb7751',
  'e2e/gradebook-roles/journey/pairing-proof.mjs': '6a2377ef90510a0394bbba464f7820274d81526e',
  'e2e/gradebook-roles/journey/shot-core.mjs': '527d4c0eaf9190efc25c57cbe81ff2af0c37795d',
  'e2e/gradebook-roles/journey/observe-core.mjs': 'efc00aa3eeb1a220080b71ad53b06d9602c97a1a',
  'scripts/gradebook-fixture/journey/private-psql.mjs': '8077eccfc6f6bc85cd391bc13efff071f3b9f27a',
  'scripts/gradebook-fixture/journey/pairing-producer.mjs': 'e58b7c814c699363913e22d0bc5884e904e3f7da',
  'scripts/gradebook-fixture/journey/shot-export.mjs': '3ecad8e4d3f62a3fff7b6f195fd6dc4554249196',
}));
