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

/** Request-observation verdicts (observe-core OBS_* failures reduced to one fixed word; COUNT split by direction).
 *  COUNT_ZERO means zero EXACT matches of the wanted call. It may coexist with a near miss (a similar call that did not
 *  match exactly), so it never means "no request was sent" and never names a unique cause on its own. */
export const OBS_KINDS = Object.freeze(['COUNT_ZERO', 'COUNT_UNDER', 'COUNT_OVER', 'STATUS', 'FAILED', 'PENDING', 'NEAR_MISS', 'ORDER', 'OTHER']);
/**
 * One OBS_KINDS word for a non-empty observe-core verdict (DIAGNOSTIC only: any failure still fails). Precedence: COUNT
 * (ZERO / UNDER / OVER against the wanted count), STATUS, FAILED, PENDING, NEAR_MISS, ORDER; else OTHER.
 * @param {string[]} failures @param {number} want
 */
export function obsKind(failures, want) {
  const list = Array.isArray(failures) ? failures.filter((f) => typeof f === 'string') : [];
  const count = list.find((f) => f.startsWith('OBS_COUNT '));
  if (count) {
    const n = Number(count.split(' ').at(-1));
    if (!Number.isInteger(n) || n < 0) return 'OTHER';
    return n === 0 ? 'COUNT_ZERO' : n > want ? 'COUNT_OVER' : 'COUNT_UNDER';
  }
  for (const [p, k] of [['OBS_STATUS ', 'STATUS'], ['OBS_FAILED ', 'FAILED'], ['OBS_PENDING ', 'PENDING'], ['OBS_NEAR_MISS ', 'NEAR_MISS'], ['OBS_ORDER ', 'ORDER']]) {
    if (list.some((f) => f.startsWith(p))) return k;
  }
  return 'OTHER';
}
/** R1 keyboard drop, from dnd-kit's own onDragEnd announcement after the drop key, and whether the window scrolled. A read
 *  that failed, or returned nothing usable, is DROP_UNAVAILABLE / SCROLL_UNAVAILABLE: never a default such as NO_DROP or STILL. */
export const R1_DROPS = Object.freeze(['DROP_TARGET', 'DROP_SELF', 'DROP_OTHER', 'DROP_NONE', 'NO_DROP', 'DROP_UNAVAILABLE']);
export const R1_SCROLLS = Object.freeze(['SCROLLED', 'STILL', 'SCROLL_UNAVAILABLE']);

/** BA-R1S SYNCHRONIZED-INPUT CANDIDATE words (r1-sync.mjs). Page words come from the page; R1S_WAIT keeps the bounded
 *  condition waiting; NOT_READ and TIMEOUT_* are gate outcomes only. Every word except OVER_TARGET stops before the drop. */
export const R1S_PRE = Object.freeze(['CLEAN', 'STALE', 'AMBIGUOUS', 'ABSENT', 'READ_ERROR']);
export const R1S_PAGE = Object.freeze(['OVER_TARGET', 'PICKED', 'OVER_SELF', 'NOT_ANNOUNCED', 'OVER_OTHER', 'NOT_OVER', 'ENDED',
  'NOT_ACTIVE', 'WRONG_DRAG', 'AMBIGUOUS', 'ABSENT', 'OTHER', 'READ_ERROR']);
export const R1S_WAIT = Object.freeze(['PICKED', 'OVER_SELF', 'NOT_ANNOUNCED']);
export const R1S_WORDS = Object.freeze([...R1S_PAGE, 'NOT_READ', ...R1S_WAIT.map((w) => `TIMEOUT_${w}`), 'TIMEOUT_NOT_READ', 'TIMEOUT_UNSETTLED']);

/**
 * Reduce dnd-kit's live-region texts to one R1_DROPS word. `texts` is what the spec read, or null when the read failed.
 * No region, a non-string entry, or unusable ids is DROP_UNAVAILABLE. Ids are compared here, never printed.
 */
export function r1DropKind(texts, moving, target) {
  if (!Array.isArray(texts) || texts.length === 0 || !texts.every((t) => typeof t === 'string')) return 'DROP_UNAVAILABLE';
  if (typeof moving !== 'string' || typeof target !== 'string' || !moving || !target || moving === target) return 'DROP_UNAVAILABLE';
  const pre = `Draggable item ${moving} was dropped`;
  const t = texts.map((x) => x.trim()).find((x) => x.startsWith(pre));
  if (t === undefined) return 'NO_DROP';
  if (t === `${pre}.`) return 'DROP_NONE';
  if (t === `${pre} over droppable area ${target}`) return 'DROP_TARGET';
  if (t === `${pre} over droppable area ${moving}`) return 'DROP_SELF';
  return 'DROP_OTHER';
}

/** SCROLLED / STILL only from two valid samples (finite numbers); anything else is SCROLL_UNAVAILABLE. */
export function r1ScrollKind(before, after) {
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!ok(before) || !ok(after)) return 'SCROLL_UNAVAILABLE';
  return before === after ? 'STILL' : 'SCROLLED';
}

/** The R1 failure code. The primary category is the observer's own BA_OBS_E_<kind> when the error is exactly that, else
 *  OTHER; drop and scroll words outside their lists become their UNAVAILABLE word. */
export function r1Code(message, drop, scroll) {
  const m = typeof message === 'string' ? /^BA_OBS_E_([A-Z_]+)$/.exec(message) : null;
  const primary = m && OBS_KINDS.includes(m[1]) ? m[1] : 'OTHER';
  return `BA_R1_E_${primary}_${R1_DROPS.includes(drop) ? drop : 'DROP_UNAVAILABLE'}_${R1_SCROLLS.includes(scroll) ? scroll : 'SCROLL_UNAVAILABLE'}`;
}

/** Every own error code a spec or helper throws inside a test (the error class). Generated codes are products of the
 *  fixed lists above, so the set stays finite and every member is a constant written here. */
export const TEST_ERRORS = map(['BA_E_NO_SESSION', 'BA_E_READ_MODULES', 'BA_E_READ_CONTENT_ITEMS', 'BA_E_NO_RUN_DIR', 'BA_E_PROJECT',
  'BA_E_CREATED_RECORD', 'BA_R1_E_LOCATE', 'BA_R2_E_LAYOUT', 'BA_SHOT_E_NAME', 'BA_SHOT_E_EXCLUSIVE_CREATE', 'BA_SHOT_E_WRITE',
  ...OBS_KINDS.map((o) => `BA_OBS_E_${o}`),
  ...OBS_KINDS.flatMap((o) => R1_DROPS.flatMap((d) => R1_SCROLLS.map((s) => `BA_R1_E_${o}_${d}_${s}`))),
  'BA_R1S_E_LOCATE', ...R1S_PRE.filter((w) => w !== 'CLEAN').map((w) => `BA_R1S_E_PRE_${w}`),
  ...R1S_WORDS.filter((w) => w !== 'OVER_TARGET').map((w) => `BA_R1S_E_${w}`)]);
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
