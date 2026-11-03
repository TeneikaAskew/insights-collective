// ABOUTME: BA-R1S SYNCHRONIZED-INPUT CANDIDATE (test-only). It is NOT a product fix and does NOT repair or replace the rapid-input
// ABOUTME: BA-R1 RED: before the final Space it waits for the current drag's moving->target announcement, else it stops.
//
// Two self-contained page functions (passed to Locator.evaluate, so they use nothing from this module) return ONE fixed
// word each; ids are compared inside the page and never leave it. r1SyncDrop is the Node-side gate the spec and the model
// test both use: it calls `drop` (the final Space) only on OVER_TARGET and otherwise throws one fixed code without it, so
// a failed condition sends no reorder.
import { R1S_PRE, R1S_PAGE, R1S_WORDS, R1S_WAIT } from './codes.mjs';

/**
 * Before the pickup (no key pressed yet). CLEAN only when the handle is connected, a live region exists, no element is
 * pressed, and no region already holds the exact moving->target announcement (a stale one would satisfy the later
 * condition falsely).
 * @returns {'CLEAN'|'STALE'|'AMBIGUOUS'|'ABSENT'|'READ_ERROR'}
 */
export function r1SyncPre(handle, a) {
  try {
    if (!a || typeof a.moving !== 'string' || typeof a.target !== 'string' || !a.moving || !a.target || a.moving === a.target) return 'READ_ERROR';
    // A detached (unmounted or replaced) handle is not the live activator: READ_ERROR, never CLEAN.
    if (!(handle instanceof Element) || handle.isConnected !== true || handle.ownerDocument !== document) return 'READ_ERROR';
    const regions = Array.from(document.querySelectorAll('[id^="DndLiveRegion"]'));
    if (regions.length === 0) return 'ABSENT';
    if (document.querySelectorAll('[aria-pressed="true"]').length !== 0) return 'AMBIGUOUS';
    const want = 'Draggable item ' + a.moving + ' was moved over droppable area ' + a.target + '.';
    return regions.some((n) => (n.textContent || '').trim() === want) ? 'STALE' : 'CLEAN';
  } catch { return 'READ_ERROR'; }
}

/**
 * After the ArrowDown: the current drag's state, from dnd-kit's own announcement templates (core :45-62) and the
 * activator's aria-pressed (core :3436). OVER_TARGET needs: exactly one pressed element, which is THIS handle, and exactly
 * one region naming the moving item, whose text is exactly the moving->target announcement.
 * @returns {string} one R1S_PAGE word
 */
export function r1SyncState(handle, a) {
  try {
    if (!a || typeof a.moving !== 'string' || typeof a.target !== 'string' || !a.moving || !a.target || a.moving === a.target) return 'READ_ERROR';
    // A detached (unmounted or replaced) handle is not the live activator: READ_ERROR, never OVER_TARGET.
    if (!(handle instanceof Element) || handle.isConnected !== true || handle.ownerDocument !== document) return 'READ_ERROR';
    const regions = Array.from(document.querySelectorAll('[id^="DndLiveRegion"]'));
    if (regions.length === 0) return 'ABSENT';
    // Active means exactly ONE pressed element in the document, and it is this connected handle.
    const pressed = Array.from(document.querySelectorAll('[aria-pressed="true"]'));
    if (pressed.length > 1) return 'AMBIGUOUS';
    if (pressed.length === 0) return 'NOT_ACTIVE';
    if (pressed[0] !== handle) return 'WRONG_DRAG';
    if (handle.getAttribute('aria-pressed') !== 'true') return 'NOT_ACTIVE';
    const m = a.moving;
    const mine = regions.map((n) => (n.textContent || '').trim()).filter((t) => t.includes('item ' + m + ' ') || t.includes('item ' + m + '.'));
    if (mine.length > 1) return 'AMBIGUOUS';
    if (mine.length === 0) return 'NOT_ANNOUNCED';
    const t = mine[0];
    const over = 'Draggable item ' + m + ' was moved over droppable area ';
    if (t === 'Picked up draggable item ' + m + '.') return 'PICKED';
    if (t === over + a.target + '.') return 'OVER_TARGET';
    if (t === over + m + '.') return 'OVER_SELF';
    if (t.startsWith(over)) return 'OVER_OTHER';
    if (t === 'Draggable item ' + m + ' is no longer over a droppable area.') return 'NOT_OVER';
    if (t.startsWith('Draggable item ' + m + ' was dropped') || t.startsWith('Dragging was cancelled.')) return 'ENDED';
    return 'OTHER';
  } catch { return 'READ_ERROR'; }
}

/**
 * The candidate gate. `read()` resolves to one page word (a throw is READ_ERROR; anything outside the list is OTHER).
 * `wait(probe)` must resolve once probe() returns 'DONE' and reject at its own bound (the spec passes expect.poll with a
 * timeout). A wait word (R1S_WAIT) keeps waiting; any other word ends the wait at once. Only OVER_TARGET calls drop();
 * every other outcome throws BA_R1S_E_<word> (TIMEOUT_<last wait word> at the bound; NOT_READ if wait resolved without
 * a probe) and drop() is never called.
 */
export async function r1SyncDrop({ read, wait, drop }) {
  let last = 'NOT_READ';
  const probe = async () => {
    let w;
    try { w = await read(); } catch { w = 'READ_ERROR'; }
    last = typeof w === 'string' && R1S_PAGE.includes(w) ? w : 'OTHER';
    return R1S_WAIT.includes(last) ? 'WAIT' : 'DONE';
  };
  let bounded = false;
  try { await wait(probe); } catch { bounded = true; }
  // Fail closed: a bounded wait never drops, even if the last read happened to be OVER_TARGET (TIMEOUT_UNSETTLED).
  const word = !bounded ? last
    : R1S_WAIT.includes(last) ? `TIMEOUT_${last}` : last === 'NOT_READ' ? 'TIMEOUT_NOT_READ' : last === 'OVER_TARGET' ? 'TIMEOUT_UNSETTLED' : last;
  if (word !== 'OVER_TARGET') throw new Error(`BA_R1S_E_${word}`);
  await drop();
  return word;
}

export { R1S_PRE, R1S_PAGE, R1S_WORDS, R1S_WAIT };
