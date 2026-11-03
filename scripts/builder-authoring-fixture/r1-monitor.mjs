// ABOUTME: R1 dnd-kit monitor observation (TEST-ONLY DIAGNOSTIC): an in-page listener registered in dnd-kit's OWN monitor
// ABOUTME: (the one its announcer uses), reached read-only from the handle's React DOM expando, and a Node reducer to fixed words.
//
// Source pins (React 18.3.1, @dnd-kit/core 6.3.1 core.esm.js): the section DndContext renders
//   DndMonitorContext.Provider(value=registerMonitorListener, :3353) > InternalContext.Provider(9 keys, :3337-3350)
//   > PublicContext.Provider(17 keys, :3315-3336), each the direct parent fiber (tag 10) of the next.
// registerMonitorListener(listener) adds it to a Set and returns () => Set.delete(listener) (:20-37). The library calls
// listeners after the product callback with the SAME event object: onDragMove (passive effect on translate, :3210-3240),
// onDragOver (passive effect on overId; it is where setOver is CALLED, :3241-3282), onDragEnd / onDragCancel (end handler
// after the product's onDragEnd/onDragCancel, :3121-3172; Escape, resize, visibility and cancelDrop take onDragCancel).
// Words: move_collision = the monitor event's collisions[0]; over_requested = the over the library DISPATCHED to setOver
// (not proof it committed); end_over = the over on the actual end event, after the product callback. No rects: geometry,
// measurement and timing causes stay OPEN; a pattern of words is an observation, not a cause.
// Privacy: each event is reduced at once to letters and capped counters; no fiber, event, id, rect or text is kept or
// returned. Non-interference: no product prop, state or DOM write; the listener never throws (an exception inside the
// library's forEach would skip later listeners) and returns nothing; the key listener is passive.

export const R1_MONITOR_FIELDS = Object.freeze(Object.assign(Object.create(null), {
  ctx: Object.freeze(['LIVE', 'NOT_INSTALLED', 'NOT_FOUND', 'REFUSED', 'READ_FAILED', 'READ_TIMEOUT', 'LATE', 'OBSERVER_ERROR', 'CONTINUITY_BROKEN']),
  seq: Object.freeze(['BOUND', 'SEQ_MISMATCH', 'UNAVAILABLE']),
  move_collision: Object.freeze(['SELF', 'TARGET', 'OTHER', 'NONE', 'UNKNOWN']),
  over_requested: Object.freeze(['NONE', 'SELF', 'TARGET', 'OTHER', 'NULL', 'MULTIPLE', 'UNKNOWN']),
  end: Object.freeze(['DROP', 'CANCELLED', 'NONE', 'MULTIPLE', 'UNKNOWN']),
  end_over: Object.freeze(['SELF', 'TARGET', 'OTHER', 'NONE', 'UNKNOWN']),
}));
export const R1_MONITOR_ORDER = Object.freeze(['ctx', 'seq', 'move_collision', 'over_requested', 'end', 'end_over']);
export const R1_MONITOR_ANNOTATION = 'ba_r1_monitor';

/**
 * IN PAGE. Self-contained (Playwright sends its source). `el` is the moving section's reorder handle.
 * Returns 'INSTALLED', 'NOT_FOUND' (pinned ancestry or identity not matched exactly) or 'REFUSED' (bad input, an existing
 * slot of any owner, or any acquisition fault; everything acquired is released).
 */
export function r1MonitorInstall(el, a) {
  var K = Symbol.for('ba.r1.monitor.v1');
  var PUB = ['active', 'activeNode', 'activeNodeRect', 'activatorEvent', 'collisions', 'containerNodeRect', 'dragOverlay', 'draggableNodes',
    'droppableContainers', 'droppableRects', 'over', 'measureDroppableContainers', 'scrollableAncestors', 'scrollableAncestorRects',
    'measuringConfiguration', 'measuringScheduled', 'windowRect'];
  var INT = ['activatorEvent', 'activators', 'active', 'activeNodeRect', 'ariaDescribedById', 'dispatch', 'draggableNodes', 'over', 'measureDroppableContainers'];
  var exactKeys = function (v, ks) {
    if (!v || typeof v !== 'object') return false;
    var own = Object.keys(v); if (own.length !== ks.length) return false;
    for (var i = 0; i < ks.length; i++) if (own.indexOf(ks[i]) < 0) return false;
    return true;
  };
  var holds = function (v, id) { var c = v.droppableContainers; return !!(c && typeof c.get === 'function' && c.get(id)); };
  // Read-only: returns the registerMonitorListener of the ONE section DndContext above `node`, or null.
  var find = function (node, m, t) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return null;
    var ks = Object.keys(node).filter(function (k) { return k.indexOf('__reactFiber$') === 0; });
    if (ks.length !== 1) return null;
    var reg = null, pubs = 0, f = node[ks[0]], i = 0;
    for (; f && i < 400; f = f.return, i++) {
      if (f.tag !== 10 || !f.memoizedProps) continue;
      var v = f.memoizedProps.value;
      if (!exactKeys(v, PUB) || !holds(v, m)) continue;
      pubs++;
      if (pubs > 1) return null;                                     // nested context also holding the moving id: ambiguous
      if (!holds(v, t)) return null;
      var it = f.return, mo = it && it.return;
      if (!it || it.tag !== 10 || !it.memoizedProps || !exactKeys(it.memoizedProps.value, INT)) return null;
      if (!mo || mo.tag !== 10 || !mo.memoizedProps || typeof mo.memoizedProps.value !== 'function' || mo.memoizedProps.value.length !== 1) return null;
      reg = mo.memoizedProps.value;
      var alt = mo.alternate;                                        // the other tree must agree (stable useCallback)
      if (alt && (!alt.memoizedProps || alt.memoizedProps.value !== reg)) return null;
    }
    if (f && i >= 400) return null;                                  // walk not finished: drift
    return reg;
  };
  try {
    if (Object.prototype.hasOwnProperty.call(window, K)) return 'REFUSED';
    if (!el || typeof el !== 'object' || el.nodeType !== 1 || !el.isConnected) return 'REFUSED';
    if (!a || typeof a.moving !== 'string' || typeof a.target !== 'string' || !a.moving || !a.target || a.moving === a.target) return 'REFUSED';
    if (typeof a.ttlMs !== 'number' || !(a.ttlMs >= 20 && a.ttlMs <= 600000) || Math.floor(a.ttlMs) !== a.ttlMs) return 'REFUSED';
  } catch (_) { return 'REFUSED'; }
  var reg0;
  try { reg0 = find(el, a.moving, a.target); } catch (_) { reg0 = null; }
  if (typeof reg0 !== 'function') return 'NOT_FOUND';

  var m = a.moving, t = a.target, SAT = 9;
  var S = { live: true, late: false, errors: 0, keys: '', keysOver: false, off: 0, moves: 0, moveW: 'U', overs: 0, overW: 'U',
    drops: 0, cancels: 0, endW: 'U', endEarly: false, unreg: 'P', frozen: null };
  var sat = function (n) { return n >= SAT ? SAT : n + 1; };
  var letter = function (id) { return id === m ? 'S' : id === t ? 'T' : (typeof id === 'string' && id) || typeof id === 'number' ? 'O' : 'N'; };
  var phase = function () { return S.keys === 'SA' ? 'A' : S.keys.length >= 3 && S.keys.slice(0, 3) === 'SAS' ? 'F' : S.keys === '' || S.keys === 'S' ? 'P' : 'X'; };
  var guard = function (fn) { return function (e) { if (!S.live) return; try { fn(e); } catch (_) { S.errors = sat(S.errors); S.live = false; } }; };
  var listener = {
    onDragMove: guard(function (e) {
      if (phase() !== 'A') return;
      S.moves = sat(S.moves);
      var c = e && e.collisions;
      S.moveW = Array.isArray(c) ? (c.length ? letter(c[0] && c[0].id) : 'N') : 'U';
    }),
    onDragOver: guard(function (e) {
      if (phase() !== 'A') return;
      S.overs = sat(S.overs);
      S.overW = e && e.over ? letter(e.over.id) : 'L';
    }),
    onDragEnd: guard(function (e) {
      var p = phase(); if (p !== 'F' && p !== 'X') S.endEarly = true;
      S.drops = sat(S.drops);
      if (S.drops === 1) S.endW = e && e.over ? letter(e.over.id) : 'N';
    }),
    // A cancel counts in any key phase (pickup, after Arrow, or after the final key): it is reported CANCELLED, never early.
    onDragCancel: guard(function () { S.cancels = sat(S.cancels); }),
  };
  var onKey = function (e) {
    try {
      if (!S.live || S.keysOver) return;
      var c = e.code === 'Space' ? 'S' : e.code === 'ArrowDown' ? 'A' : e.code === 'Escape' ? 'E' : null;
      if (!c) return;
      if (e.target !== el) { S.off = sat(S.off); return; }
      if (S.keys.length >= 8) { S.keysOver = true; return; }   // saturated: key tracking stops, no growth
      S.keys += c;
    } catch (_) { S.errors = sat(S.errors); S.live = false; }
  };
  var A = { unreg: null, key: false, timer: null, slot: null };
  var released = false;
  var release = function () {
    if (released) return; released = true; S.live = false;
    if (A.unreg) { var u = A.unreg; A.unreg = null; try { S.unreg = u() === true ? 'Y' : 'F'; } catch (_) { S.unreg = 'F'; } }
    if (A.key) { A.key = false; try { window.removeEventListener('keydown', onKey, { capture: true }); } catch (_) { S.errors = sat(S.errors); } }
    if (A.timer !== null) { var tm = A.timer; A.timer = null; try { clearTimeout(tm); } catch (_) { S.errors = sat(S.errors); } }
  };
  // Returns 'Y' when our slot is gone afterwards, 'F' when it is still there (delete threw, or returned false on a
  // non-configurable slot). Checked by presence, so both strict and sloppy delete behaviour classify the same way.
  var dropSlot = function () {
    var mine = A.slot || api; A.slot = null;
    try { if (window[K] === mine) delete window[K]; } catch (_) { /* classified by presence below */ }
    try { return Object.prototype.hasOwnProperty.call(window, K) && window[K] === mine ? 'F' : 'Y'; } catch (_) { return 'F'; }
  };
  // The read result: the frozen observations unchanged, plus the slot-deletion outcome of THIS read.
  var withSlot = function (snap, d) { var o = {}; for (var k in snap) o[k] = snap[k]; o.slot = d; return o; };
  var snapshot = function (continuity) {
    return { v: 1, late: S.late, errors: S.errors, cont: continuity, unreg: S.unreg, keys: S.keys, keysOver: S.keysOver, off: S.off,
      moves: S.moves, moveW: S.moveW, overs: S.overs, overW: S.overW, drops: S.drops, cancels: S.cancels, endW: S.endW, endEarly: S.endEarly };
  };
  var freeze = function (continuity) {
    if (S.frozen) return S.frozen;
    release();
    S.frozen = snapshot(continuity);
    el = null; reg0 = null;                                        // release page references
    return S.frozen;
  };
  var api = {
    read: function () {
      if (S.frozen) return withSlot(S.frozen, dropSlot());
      var c = 'U';
      try { c = el && find(el, m, t) === reg0 ? 'Y' : 'N'; } catch (_) { c = 'N'; }
      var snap = freeze(c); return withSlot(snap, dropSlot());
    },
  };
  try {
    var u = reg0(listener);
    // No unregister function: our listener cannot be removed, so it is made inert (release sets live=false) and refused.
    if (typeof u !== 'function') throw new Error('unreg');
    A.unreg = u;
    window.addEventListener('keydown', onKey, { capture: true, passive: true }); A.key = true;
    A.timer = setTimeout(function () { try { S.late = true; freeze('U'); } catch (_) { /* inert */ } }, a.ttlMs);
    if (Object.prototype.hasOwnProperty.call(window, K)) throw new Error('slot');
    A.slot = api;                                                    // owned before the write, so a failed write is still undone
    window[K] = api;
    if (window[K] !== api) throw new Error('slot');
    return 'INSTALLED';
  } catch (_) {
    released = false; release(); dropSlot(); el = null; reg0 = null;
    return 'REFUSED';
  }
}

/** IN PAGE. One frozen snapshot, then cleanup; idempotent: a second read, or nothing installed, returns null. */
export function r1MonitorRead() {
  var K = Symbol.for('ba.r1.monitor.v1');
  try {
    var rec = Object.prototype.hasOwnProperty.call(window, K) ? window[K] : null;
    if (!rec || typeof rec.read !== 'function') return null;
    return rec.read();
  } catch (_) { return null; }
}

const SNAP_KEYS = ['v', 'late', 'errors', 'cont', 'unreg', 'keys', 'keysOver', 'off', 'moves', 'moveW', 'overs', 'overW', 'drops', 'cancels', 'endW', 'endEarly', 'slot'];
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const ID = { S: 'SELF', T: 'TARGET', O: 'OTHER', N: 'NONE', U: 'UNKNOWN' };
const OVER = { S: 'SELF', T: 'TARGET', O: 'OTHER', L: 'NULL', N: 'UNKNOWN', U: 'UNKNOWN' };
const cnt = (n) => Number.isInteger(n) && n >= 0 && n <= 9;
const bool = (b) => b === true || b === false;

export function validMonitorSnapshot(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || Object.getPrototypeOf(x) !== Object.prototype) return false;
  const k = Object.keys(x);
  if (k.length !== SNAP_KEYS.length || !SNAP_KEYS.every((n) => own(x, n))) return false;
  return x.v === 1 && bool(x.late) && cnt(x.errors) && ['Y', 'N', 'U'].includes(x.cont) && ['Y', 'F', 'P'].includes(x.unreg)
    && typeof x.keys === 'string' && /^[SAE]{0,8}$/.test(x.keys) && bool(x.keysOver) && cnt(x.off) && cnt(x.moves) && own(ID, x.moveW)
    && cnt(x.overs) && own(OVER, x.overW) && cnt(x.drops) && cnt(x.cancels) && own(ID, x.endW) && bool(x.endEarly) && ['Y', 'F'].includes(x.slot);
}

const UNK = (ctx, seq = 'UNAVAILABLE') => ({ ctx, seq, move_collision: 'UNKNOWN', over_requested: 'UNKNOWN', end: 'UNKNOWN', end_over: 'UNKNOWN' });

/** Snapshot -> fixed words. `installed` is the install return value. Observations only, never a cause. */
export function r1MonitorFields(installed, snap, readState = 'OK') {
  if (installed === 'NOT_FOUND') return UNK('NOT_FOUND');
  if (installed === 'REFUSED') return UNK('REFUSED');
  if (installed !== 'INSTALLED') return UNK('NOT_INSTALLED');
  if (readState === 'TIMEOUT') return UNK('READ_TIMEOUT');
  if (readState !== 'OK' || !validMonitorSnapshot(snap)) return UNK('READ_FAILED');
  if (snap.late) return UNK('LATE');
  if (snap.errors > 0 || snap.unreg !== 'Y' || snap.slot !== 'Y') return UNK('OBSERVER_ERROR');
  if (snap.cont !== 'Y') return UNK('CONTINUITY_BROKEN');
  const ends = snap.drops + snap.cancels;
  // end does not depend on the key binding: an actual cancel stays CANCELLED (end_over UNKNOWN) even with Escape.
  // An early DROP stays UNKNOWN and several ends stay MULTIPLE; one cancel alone is CANCELLED in any key phase.
  const end = snap.endEarly ? 'UNKNOWN' : ends === 0 ? 'NONE' : ends > 1 ? 'MULTIPLE' : snap.cancels === 1 ? 'CANCELLED' : 'DROP';
  const bound = !snap.keysOver && snap.off === 0 && snap.keys === 'SAS';
  if (!bound) return { ...UNK('LIVE', 'SEQ_MISMATCH'), end };
  return {
    ctx: 'LIVE', seq: 'BOUND',
    move_collision: snap.moves === 1 ? ID[snap.moveW] : 'UNKNOWN',
    over_requested: snap.overs === 0 ? 'NONE' : snap.overs > 1 ? 'MULTIPLE' : OVER[snap.overW],
    end,
    end_over: end === 'DROP' ? ID[snap.endW] : 'UNKNOWN',
  };
}

export function r1MonitorDescription(installed, snap, readState = 'OK') {
  const f = r1MonitorFields(installed, snap, readState);
  return R1_MONITOR_ORDER.map((k) => `${k}=${f[k]}`).join(' ');
}

/** Parse a description back to fields, own-key and word-list checked; null if anything is off. Printed values are list
 *  constants, never the input. */
export function parseR1Monitor(description) {
  if (typeof description !== 'string' || description.length > 256) return null;
  const parts = description.split(' ');
  if (parts.length !== R1_MONITOR_ORDER.length) return null;
  const out = Object.create(null);
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    const k = parts[i].slice(0, eq), v = parts[i].slice(eq + 1);
    if (eq < 1 || k !== R1_MONITOR_ORDER[i] || !own(R1_MONITOR_FIELDS, k)) return null;
    const idx = R1_MONITOR_FIELDS[k].indexOf(v);
    if (idx < 0) return null;
    out[k] = R1_MONITOR_FIELDS[k][idx];
  }
  return out;
}
