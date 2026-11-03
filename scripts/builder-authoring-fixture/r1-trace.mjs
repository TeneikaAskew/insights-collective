// ABOUTME: Passive R1 keyboard-reorder trace: an in-page recorder (serialized by Playwright, self-contained) and a Node
// ABOUTME: reducer that turns its snapshot into fixed words. Diagnostic only: it never decides a test result.
//
// Privacy: the page functions receive the two fixture section ids only to classify dnd-kit's own announcements inside the
// page. The snapshot they return holds fixed enum letters, booleans and capped counters, never text, ids, DOM, URLs or
// tokens. The reducer accepts only that exact shape; anything else is UNAVAILABLE.
// Non-interference: listeners are passive, never call preventDefault / stopPropagation, and are removed by the read.

/** Field -> allowed words. Printed values are always these constants. */
export const R1_TRACE_FIELDS = Object.freeze(Object.assign(Object.create(null), {
  ctx: Object.freeze(['LIVE', 'NOT_INSTALLED', 'READ_FAILED', 'READ_TIMEOUT', 'RECORDER_ERROR']),
  keys: Object.freeze(['ALL_ON_HANDLE', 'SOME_OFF_HANDLE', 'NONE_SEEN', 'SEQ_MISMATCH', 'UNAVAILABLE']),
  first_space: Object.freeze(['PREVENTED', 'NOT_PREVENTED', 'UNAVAILABLE']),
  // The SAME first captured ArrowDown at three passive points: window capture, a document bubble listener added at install,
  // window bubble. Observation words only; a pattern of them is informative, not a diagnosis.
  arrow_capture: Object.freeze(['PREVENTED', 'NOT_PREVENTED', 'UNAVAILABLE']),
  arrow_document: Object.freeze(['PREVENTED', 'NOT_PREVENTED', 'NOT_DELIVERED', 'UNAVAILABLE']),
  arrow_bubble: Object.freeze(['PREVENTED', 'NOT_PREVENTED', 'NOT_DELIVERED', 'UNAVAILABLE']),
  moved: Object.freeze(['MOVED', 'NO_CHANGE_OBSERVED', 'UNAVAILABLE']),
  ann: Object.freeze(['NONE', 'PICKED', 'OVER_TARGET', 'OVER_SELF', 'OVER_OTHER', 'NOT_OVER', 'DROP_TARGET', 'DROP_SELF',
    'DROP_OTHER', 'DROP_NONE', 'CANCELLED', 'UNAVAILABLE']),
  drop_seen: Object.freeze(['YES', 'NO', 'UNAVAILABLE']),
  pressed: Object.freeze(['PRESSED_AT_END', 'PRESSED_RELEASED', 'NEVER_PRESSED', 'UNAVAILABLE']),
  dom: Object.freeze(['STABLE', 'HANDLE_DETACHED', 'REGION_REPLACED', 'BOTH', 'UNAVAILABLE']),
  scroll_events: Object.freeze(['ANY', 'NONE', 'UNAVAILABLE']),
}));
export const R1_TRACE_ORDER = Object.freeze(['ctx', 'keys', 'first_space', 'arrow_capture', 'arrow_document', 'arrow_bubble', 'moved', 'ann', 'drop_seen', 'pressed', 'dom', 'scroll_events']);
export const R1_TRACE_ANNOTATION = 'ba_r1_trace';
/** Page-side self-expiry bounds (ms) and the spec's read deadline (ms). */
export const R1_TRACE_TTL = Object.freeze({ min: 20, max: 600_000, spec: 120_000 });
export const R1_TRACE_READ_DEADLINE_MS = 3_000;

/**
 * IN PAGE. Installs the recorder on `el` (the section's reorder handle). Self-contained: Playwright sends its source.
 * Returns 'INSTALLED' or 'REFUSED' (bad element, ids or ttl, already installed, or any setup error; nothing is left behind).
 * The recorder removes itself after `a.ttlMs` even if it is never read, so a missed or late read cannot leave it alive.
 */
export function r1TraceInstall(el, a) {
  var K = Symbol.for('ba.r1.trace.v1');
  var added = [];
  var observer = null;
  try {
    if (window[K]) return 'REFUSED';
    if (!el || typeof el !== 'object' || el.nodeType !== 1 || !el.isConnected) return 'REFUSED';
    if (!a || typeof a.moving !== 'string' || typeof a.target !== 'string' || !a.moving || !a.target || a.moving === a.target) return 'REFUSED';
    if (typeof a.ttlMs !== 'number' || !(a.ttlMs >= 20 && a.ttlMs <= 600000) || Math.floor(a.ttlMs) !== a.ttlMs) return 'REFUSED';
    var CAP = 99, SEQ = 8;
    var m = a.moving, t = a.target;
    var timer = null;
    // firstKey: the FIRST captured keydown event object (kept in page memory only). first_space is read from that same
    // event at window bubble; if it never bubbles there, it stays null (UNAVAILABLE).
    var firstKey = null;
    // firstArrow: the FIRST captured ArrowDown event object (page memory only). Its defaultPrevented is read from that same
    // event at window capture, at a document bubble listener added here (so after document listeners added earlier and
    // before any added later), and at window bubble. A point the event never reached stays null.
    var firstArrow = null;
    // A non-identity translate on the handle or an ancestor (the sortable card's inline transform). Only a boolean leaves.
    var movedStyle = function (t) {
      if (typeof t !== 'string') return false;
      var mm = /translate3d\(\s*(-?[0-9.]+)px,\s*(-?[0-9.]+)px/.exec(t);
      return !!mm && (Number(mm[1]) !== 0 || Number(mm[2]) !== 0);
    };
    var s = { frozen: false, keys: '', keysOverflow: false, onHandle: 0, firstSpacePrevented: null, regionsSeen: 0,
      arrowCapture: null, arrowDocument: null, arrowBubble: null, movedEver: false,
      annLast: 'NONE', dropSeen: false, otherText: 0, pressedEver: false, handleDetachedEver: false, regionReplaced: false,
      scrollEvents: 0, errors: 0 };
    var cap = function (n) { return n >= CAP ? CAP : n + 1; };
    var classify = function (x) {
      var d = 'Draggable item ' + m;
      if (x === 'Picked up draggable item ' + m + '.') return 'PICKED';
      if (x === d + ' was moved over droppable area ' + t + '.') return 'OVER_TARGET';
      if (x === d + ' was moved over droppable area ' + m + '.') return 'OVER_SELF';
      if (x.indexOf(d + ' was moved over droppable area ') === 0) return 'OVER_OTHER';
      if (x === d + ' is no longer over a droppable area.') return 'NOT_OVER';
      if (x === d + ' was dropped over droppable area ' + t) return 'DROP_TARGET';
      if (x === d + ' was dropped over droppable area ' + m) return 'DROP_SELF';
      if (x.indexOf(d + ' was dropped over droppable area ') === 0) return 'DROP_OTHER';
      if (x === d + ' was dropped.') return 'DROP_NONE';
      if (x === 'Dragging was cancelled. ' + d + ' was dropped.') return 'CANCELLED';
      return null;
    };
    var known = new Set();
    var regionTexts = new WeakSet();
    var lastText = new WeakMap();
    var regions = function () { return Array.prototype.slice.call(document.querySelectorAll('[id^="DndLiveRegion"]')); };
    var touched = new Set();
    var inRegion = function (n) {
      for (var p = n; p; p = p.parentNode) {
        if (p.nodeType === 1 && typeof p.id === 'string' && p.id.indexOf('DndLiveRegion') === 0) { touched.add(p); return true; }
      }
      return false;
    };
    var see = function (x) {
      x = String(x == null ? '' : x).trim();
      if (x === '') return;
      var c = classify(x);
      if (c === null) { s.otherText = cap(s.otherText); return; }
      s.annLast = c;
      if (c.indexOf('DROP_') === 0) s.dropSeen = true;
    };
    // Records keep transient states that the current DOM no longer shows: a handle removed and re-added, a region removed,
    // and every intermediate announcement text (characterData old values; text nodes added).
    var processRecords = function (records) {
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        if (rec.type === 'childList') {
          var targetIsRegion = inRegion(rec.target);
          for (var j = 0; j < rec.removedNodes.length; j++) {
            var n = rec.removedNodes[j];
            if (n === el || (n.nodeType === 1 && n.contains(el))) s.handleDetachedEver = true;
            // A removed region (or a removed text node of one) keeps its final text: read it, so a drop written just
            // before a removal or replacement in the same batch is not lost.
            known.forEach(function (r) { if (n === r || (n.nodeType === 1 && n.contains(r))) { s.regionReplaced = true; see(r.textContent); } });
            if (n.nodeType === 3 && (targetIsRegion || regionTexts.has(n))) see(n.data);
          }
          for (var q = 0; q < rec.addedNodes.length; q++) {
            var an = rec.addedNodes[q];
            if (an.nodeType === 3 && targetIsRegion) { regionTexts.add(an); see(an.data); }
          }
        } else if (rec.type === 'characterData' && (regionTexts.has(rec.target) || inRegion(rec.target))) {
          // the old value; the final value is read from the region or text node when either is removed, or by the scan
          see(rec.oldValue);
        } else if (rec.type === 'attributes' && rec.attributeName === 'aria-pressed' && rec.target === el && (rec.oldValue === 'true' || el.getAttribute('aria-pressed') === 'true')) {
          s.pressedEver = true;
        } else if (rec.type === 'attributes' && rec.attributeName === 'style' && rec.target.nodeType === 1 && rec.target.contains(el)
          && (movedStyle(rec.oldValue) || movedStyle(rec.target.getAttribute('style')))) {
          // the old value keeps a transform that was set and cleared again before this batch was delivered
          s.movedEver = true;
        }
      }
    };
    var scan = function () {
      var now = regions();
      known.forEach(function (r) { if (!r.isConnected) s.regionReplaced = true; });
      for (var i = 0; i < now.length; i++) {
        var r = now[i];
        if (!known.has(r)) { if (initialised) s.regionReplaced = true; known.add(r); s.regionsSeen = cap(s.regionsSeen); }
        for (var c = r.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) regionTexts.add(c);
        var x = String(r.textContent == null ? '' : r.textContent).trim();
        if (lastText.get(r) === x && !touched.has(r)) continue;
        lastText.set(r, x);
        see(x);
      }
      touched.clear();
      if (!el.isConnected) s.handleDetachedEver = true;
      else for (var pe = el; pe && pe.nodeType === 1; pe = pe.parentNode) if (movedStyle(pe.getAttribute('style'))) s.movedEver = true;
      if (el.getAttribute('aria-pressed') === 'true') s.pressedEver = true;
    };
    var initialised = false;
    var guard = function (fn) { return function (e) { if (s.frozen) return; try { fn(e); } catch (_) { s.errors = cap(s.errors); } }; };
    var on = function (target, type, fn, capture) {
      var h = guard(fn);
      target.addEventListener(type, h, { capture: capture, passive: true });
      added.push([target, type, h, capture]);
    };
    on(window, 'keydown', function (e) {
      if (firstKey === null) firstKey = e;
      if (firstArrow === null && e.code === 'ArrowDown') { firstArrow = e; s.arrowCapture = e.defaultPrevented === true; }
      if (s.keys.length >= SEQ) { s.keysOverflow = true; return; }
      s.keys += e.code === 'Space' ? 'S' : e.code === 'ArrowDown' ? 'A' : 'O';
      if (e.target === el && el.isConnected) s.onHandle = cap(s.onHandle);
    }, true);
    on(window, 'keydown', function (e) {
      if (e === firstKey && e.code === 'Space') s.firstSpacePrevented = e.defaultPrevented === true;
      if (e === firstArrow) s.arrowBubble = e.defaultPrevented === true;
    }, false);
    on(document, 'keydown', function (e) {
      if (e === firstArrow) s.arrowDocument = e.defaultPrevented === true;
    }, false);
    on(window, 'scroll', function () { s.scrollEvents = cap(s.scrollEvents); }, true);
    var handleRecords = guard(function (records) { processRecords(records || []); scan(); });
    observer = new MutationObserver(handleRecords);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, characterDataOldValue: true,
      attributes: true, attributeOldValue: true, attributeFilter: ['aria-pressed', 'style'] });
    scan();
    initialised = true;
    var cleanup = function () {
      s.frozen = true;
      firstKey = null;
      firstArrow = null;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (observer) { observer.disconnect(); observer = null; }
      while (added.length) { var x = added.pop(); x[0].removeEventListener(x[1], x[2], { capture: x[3] }); }
    };
    var rec = {
      flush: function () { if (!s.frozen && observer) handleRecords(observer.takeRecords()); },
      snapshot: function () {
        return { v: 3, regionsSeen: s.regionsSeen, keys: s.keys, keysOverflow: s.keysOverflow, onHandle: s.onHandle, firstSpacePrevented: s.firstSpacePrevented,
          arrowCapture: s.arrowCapture, arrowDocument: s.arrowDocument, arrowBubble: s.arrowBubble, movedEver: s.movedEver,
          annLast: s.annLast, dropSeen: s.dropSeen, otherText: s.otherText, pressedEver: s.pressedEver,
          pressedAtEnd: el.isConnected && el.getAttribute('aria-pressed') === 'true', handleDetachedEver: s.handleDetachedEver || !el.isConnected,
          regionReplaced: s.regionReplaced, scrollEvents: s.scrollEvents, errors: s.errors };
      },
      cleanup: cleanup,
    };
    Object.defineProperty(window, K, { value: rec, configurable: true, enumerable: false, writable: false });
    timer = setTimeout(function () { timer = null; try { cleanup(); } catch (_) { /* frozen either way */ } try { if (window[K] === rec) delete window[K]; } catch (_) { /* gone with the page */ } }, a.ttlMs);
    return 'INSTALLED';
  } catch (_) {
    try { if (observer) observer.disconnect(); } catch (_e) { /* nothing more to undo */ }
    try { if (timer !== null) clearTimeout(timer); } catch (_e) { /* nothing more to undo */ }
    while (added.length) { var y = added.pop(); try { y[0].removeEventListener(y[1], y[2], { capture: y[3] }); } catch (_e) { /* best effort */ } }
    return 'REFUSED';
  }
}

/**
 * IN PAGE. Flushes pending records, takes ONE frozen snapshot, removes every listener and the observer, and deletes the
 * recorder. A second read, or a read with nothing installed, returns null. Self-contained.
 */
export function r1TraceRead() {
  var K = Symbol.for('ba.r1.trace.v1');
  var rec = window[K];
  if (!rec) return null;
  var snap = null;
  try { rec.flush(); snap = rec.snapshot(); } catch (_) { snap = null; }
  try { rec.cleanup(); } catch (_) { snap = null; }
  try { delete window[K]; } catch (_) { snap = null; }
  return snap;
}

const SNAP_KEYS = ['v', 'regionsSeen', 'keys', 'keysOverflow', 'onHandle', 'firstSpacePrevented', 'arrowCapture', 'arrowDocument', 'arrowBubble', 'movedEver', 'annLast', 'dropSeen', 'otherText', 'pressedEver',
  'pressedAtEnd', 'handleDetachedEver', 'regionReplaced', 'scrollEvents', 'errors'];
const ANN_SEEN = new Set(R1_TRACE_FIELDS.ann.filter((w) => w !== 'UNAVAILABLE'));
const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
const isBool = (b) => b === true || b === false;

/** Exact snapshot shape, else false. */
export function validSnapshot(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || Object.getPrototypeOf(x) !== Object.prototype) return false;
  const k = Object.keys(x);
  if (k.length !== SNAP_KEYS.length || !SNAP_KEYS.every((n) => Object.prototype.hasOwnProperty.call(x, n))) return false;
  const nb = (b) => b === null || isBool(b);
  return x.v === 3 && isCount(x.regionsSeen) && typeof x.keys === 'string' && /^[SAO]{0,8}$/.test(x.keys) && isBool(x.keysOverflow) && isCount(x.onHandle)
    && (x.firstSpacePrevented === null || isBool(x.firstSpacePrevented))
    && nb(x.arrowCapture) && nb(x.arrowDocument) && nb(x.arrowBubble)
    && !(x.arrowCapture === null && (x.arrowDocument !== null || x.arrowBubble !== null)) && isBool(x.movedEver)
    && typeof x.annLast === 'string' && ANN_SEEN.has(x.annLast)
    && isBool(x.dropSeen) && isCount(x.otherText) && isBool(x.pressedEver) && isBool(x.pressedAtEnd) && isBool(x.handleDetachedEver)
    && isBool(x.regionReplaced) && isCount(x.scrollEvents) && isCount(x.errors);
}

const UNAV = (ctx) => ({ ctx, keys: 'UNAVAILABLE', first_space: 'UNAVAILABLE', arrow_capture: 'UNAVAILABLE',
  arrow_document: 'UNAVAILABLE', arrow_bubble: 'UNAVAILABLE', moved: 'UNAVAILABLE', ann: 'UNAVAILABLE', drop_seen: 'UNAVAILABLE',
  pressed: 'UNAVAILABLE', dom: 'UNAVAILABLE', scroll_events: 'UNAVAILABLE' });

/** Snapshot -> fixed words. Words describe what was recorded; they do not name a cause. */
export function r1TraceFields(installed, snap, readState = 'OK') {
  if (installed !== true) return UNAV('NOT_INSTALLED');
  if (readState === 'TIMEOUT') return UNAV('READ_TIMEOUT');
  if (readState !== 'OK' || !validSnapshot(snap)) return UNAV('READ_FAILED');
  if (snap.errors > 0) return UNAV('RECORDER_ERROR');
  const keys = snap.keysOverflow ? 'SEQ_MISMATCH' : snap.keys === '' ? 'NONE_SEEN' : snap.keys !== 'SAS' ? 'SEQ_MISMATCH'
    : snap.onHandle === 3 ? 'ALL_ON_HANDLE' : 'SOME_OFF_HANDLE';
  const first = snap.keys[0] !== 'S' || snap.firstSpacePrevented === null ? 'UNAVAILABLE' : snap.firstSpacePrevented ? 'PREVENTED' : 'NOT_PREVENTED';
  const pressed = snap.pressedAtEnd ? 'PRESSED_AT_END' : snap.pressedEver ? 'PRESSED_RELEASED' : 'NEVER_PRESSED';
  const dom = snap.handleDetachedEver && snap.regionReplaced ? 'BOTH' : snap.handleDetachedEver ? 'HANDLE_DETACHED' : snap.regionReplaced ? 'REGION_REPLACED' : 'STABLE';
  // No live region was ever seen: announcements were not observable, so they are UNAVAILABLE, not NONE / NO.
  const ann = snap.regionsSeen === 0 ? 'UNAVAILABLE' : snap.annLast;
  const dropSeen = snap.regionsSeen === 0 ? 'UNAVAILABLE' : snap.dropSeen ? 'YES' : 'NO';
  // arrow_*: the same first captured ArrowDown at each point; no ArrowDown captured => all UNAVAILABLE; captured but a later
  // point never saw it => NOT_DELIVERED. Which handler prevented it is not observed.
  const pt = (v) => (v === null ? 'NOT_DELIVERED' : v ? 'PREVENTED' : 'NOT_PREVENTED');
  const seen = snap.arrowCapture !== null;
  const arrowCapture = seen ? (snap.arrowCapture ? 'PREVENTED' : 'NOT_PREVENTED') : 'UNAVAILABLE';
  const arrowDocument = seen ? pt(snap.arrowDocument) : 'UNAVAILABLE';
  const arrowBubble = seen ? pt(snap.arrowBubble) : 'UNAVAILABLE';
  // moved: a non-identity translate seen (old or current style value) on the handle or an ancestor. Not seen is
  // NO_CHANGE_OBSERVED, never "never moved"; once the handle was detached it is UNAVAILABLE.
  const moved = snap.movedEver ? 'MOVED' : snap.handleDetachedEver ? 'UNAVAILABLE' : 'NO_CHANGE_OBSERVED';
  return { ctx: 'LIVE', keys, first_space: first, arrow_capture: arrowCapture, arrow_document: arrowDocument, arrow_bubble: arrowBubble, moved, ann, drop_seen: dropSeen, pressed, dom,
    scroll_events: snap.scrollEvents > 0 ? 'ANY' : 'NONE' };
}

/** The annotation description: `field=WORD` pairs in R1_TRACE_ORDER. */
export function r1TraceDescription(installed, snap, readState = 'OK') {
  const f = r1TraceFields(installed, snap, readState);
  return R1_TRACE_ORDER.map((k) => `${k}=${f[k]}`).join(' ');
}

/** Parse a description back to fields, own-key and word-list checked; null if anything is off. Printed values are list
 *  constants, never the input. */
export function parseR1Trace(description) {
  if (typeof description !== 'string' || description.length > 512) return null;
  const parts = description.split(' ');
  if (parts.length !== R1_TRACE_ORDER.length) return null;
  const out = Object.create(null);
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    const k = parts[i].slice(0, eq), v = parts[i].slice(eq + 1);
    if (eq < 1 || k !== R1_TRACE_ORDER[i] || !Object.prototype.hasOwnProperty.call(R1_TRACE_FIELDS, k)) return null;
    const idx = R1_TRACE_FIELDS[k].indexOf(v);
    if (idx < 0) return null;
    out[k] = R1_TRACE_FIELDS[k][idx];
  }
  return out;
}

/**
 * Bound the final read: resolves (never rejects) with { state: 'OK' | 'REJECTED' | 'TIMEOUT', snap } by `ms`. The first
 * outcome is frozen; a late resolution or rejection is ignored. The timer is cleared once settled.
 */
export function settleR1Read(start, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (state, snap) => { if (done) return; done = true; clearTimeout(timer); resolve(Object.freeze({ state, snap: state === 'OK' ? snap : null })); };
    const timer = setTimeout(() => finish('TIMEOUT', null), ms);
    let p;
    try { p = Promise.resolve(typeof start === 'function' ? start() : start); } catch { finish('REJECTED', null); return; }
    p.then((v) => finish('OK', v), () => finish('REJECTED', null));
  });
}
