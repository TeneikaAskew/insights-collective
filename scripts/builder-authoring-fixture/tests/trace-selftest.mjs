#!/usr/bin/env node
// ABOUTME: Fake-DOM controls (jsdom) for the passive R1 trace: the page functions run from their own source text, as
// ABOUTME: Playwright sends them. Proposed signatures are told apart; none is claimed to be a diagnosis of a cause.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { r1TraceInstall, r1TraceRead, r1TraceFields, r1TraceDescription, parseR1Trace, validSnapshot, settleR1Read, R1_TRACE_FIELDS,
  R1_TRACE_ORDER, R1_TRACE_ANNOTATION } from '../r1-trace.mjs';
import { summarizeReport, checkLines, LINE } from '../summary.mjs';
import { INVENTORY } from '../ids.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const { JSDOM } = createRequire(path.join(ROOT, 'package.json'))('jsdom');
let n = 0;
const tests = [];
const ok = (name, fn) => tests.push([name, fn]);

const M = '9b6e0000-0000-4000-8000-0000000000a1', T = '9b6e0000-0000-4000-8000-0000000000a2', OTHER = '9b6e0000-0000-4000-8000-0000000000a3';
const D = `Draggable item ${M}`;
const ARGS = Object.freeze({ moving: M, target: T, ttlMs: 60_000 });
const TXT = {
  picked: `Picked up draggable item ${M}.`, overT: `${D} was moved over droppable area ${T}.`, overS: `${D} was moved over droppable area ${M}.`,
  dropT: `${D} was dropped over droppable area ${T}`, dropS: `${D} was dropped over droppable area ${M}`, dropN: `${D} was dropped.`,
  cancel: `Dragging was cancelled. ${D} was dropped.`,
};

/** A fake page: a handle button inside a card, the outer live region and one inner (lesson) region. */
function page(opts = {}) {
  const regionsHtml = opts.noRegions ? '' : '<div id="DndLiveRegion-0" role="status"></div><div id="DndLiveRegion-1" role="status"></div>';
  // #list holds the moving card and a second section card with a same-label handle, as the curriculum does
  const sibling = opts.noSibling ? '' : '<div id="card2"><span><button aria-label="Reorder section"></button></span></div>';
  const list = opts.flat ? '<div id="list"><button id="h" aria-label="Reorder section"></button><button aria-label="Reorder section"></button></div>'
    : `<div id="list"><div id="card"><div id="hdr"><span><button id="h" aria-label="Reorder section"></button></span></div>
    <ul></ul></div>${sibling}</div>`;
  const dom = new JSDOM(`<!doctype html><body><div id="root">${list}${regionsHtml}</div></body>`,
  { runScripts: 'outside-only' });
  const w = dom.window;
  const counts = { add: 0, remove: 0, disconnect: 0, handlers: [] };
  const origAdd = w.addEventListener.bind(w), origRemove = w.removeEventListener.bind(w);
  w.addEventListener = (...a) => { counts.add += 1; counts.handlers.push(a[1]); return origAdd(...a); };
  w.removeEventListener = (...a) => { counts.remove += 1; return origRemove(...a); };
  const MO = w.MutationObserver;
  w.MutationObserver = class extends MO { disconnect() { counts.disconnect += 1; return super.disconnect(); } };
  // Exactly what Playwright does: the function's own source, evaluated in the page.
  const install = w.eval(`(${r1TraceInstall.toString()})`);
  // Playwright returns a serialized copy in the Node realm; structuredClone does the same here.
  const rawRead = w.eval(`(${r1TraceRead.toString()})`);
  const read = () => { const v = rawRead(); return v === null || v === undefined ? v ?? null : structuredClone(v); };
  const $ = (s) => w.document.querySelector(s);
  const key = (target, code, extra) => target.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true, ...extra }));
  const region = () => $('#DndLiveRegion-0');
  const say = (text) => { region().textContent = text; };               // React-style text replacement (childList)
  const sayInPlace = (text) => {                                          // in-place text node update (characterData)
    const r = region(); if (!r.firstChild) r.appendChild(w.document.createTextNode('')); r.firstChild.nodeValue = text;
  };
  return { dom, w, counts, install, read, $, key, say, sayInPlace, region, h: () => $('#h') };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const run = async (p, script) => {
  assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
  await script(p);
  await tick();
  const snap = p.read();
  return { snap, f: r1TraceFields(true, snap), d: r1TraceDescription(true, snap) };
};
/** A fake keyboard activator in the place React's root listener sits: picks up on the first Space, like dnd-kit would. */
const activator = (p, onPick) => {
  let picked = false;
  p.$('#root').addEventListener('keydown', (e) => {
    if (picked || e.code !== 'Space' || e.target !== p.h()) return;
    picked = true; e.preventDefault(); p.h().setAttribute('aria-pressed', 'true'); p.say(TXT.picked); onPick?.();
  });
};
const three = (p, target) => { const t = target ?? p.h(); p.key(t, 'Space'); p.key(t, 'ArrowDown'); p.key(t, 'Space'); };

// ---- proposed signatures (each is a pattern of words; none names a unique cause) ----
const SIG = {};
ok('signature (H1-shaped): keys reach body after the handle is detached and replaced', async () => {
  const p = page();
  const { f, d } = await run(p, (q) => {
    const old = q.h(); const fresh = old.cloneNode(); old.replaceWith(fresh); three(q, q.w.document.body);
  });
  assert.equal(f.keys, 'SOME_OFF_HANDLE'); assert.equal(f.dom, 'HANDLE_DETACHED'); assert.equal(f.ann, 'NONE');
  assert.equal(f.pressed, 'NEVER_PRESSED'); assert.equal(f.first_space, 'NOT_PREVENTED'); SIG.H1 = d;
});
ok('signature (H1-shaped, full remount): handle and region both replaced', async () => {
  const p = page();
  const { f } = await run(p, (q) => {
    const root = q.$('#root'); const copy = root.cloneNode(true); root.replaceWith(copy); three(q, q.w.document.body);
  });
  assert.equal(f.dom, 'BOTH'); assert.equal(f.keys, 'SOME_OFF_HANDLE');
});
ok('signature (H2-shaped): keys on the handle, nothing picks up, nothing prevents', async () => {
  const p = page();
  const { f, d } = await run(p, (q) => three(q));
  assert.deepEqual([f.keys, f.first_space, f.ann, f.pressed, f.dom], ['ALL_ON_HANDLE', 'NOT_PREVENTED', 'NONE', 'NEVER_PRESSED', 'STABLE']);
  SIG.H2 = d;
});
ok('signature (H2-shaped variant): another handler prevents the first Space, no pickup', async () => {
  const p = page();
  p.$('#card').addEventListener('keydown', (e) => e.preventDefault());
  const { f } = await run(p, (q) => three(q));
  assert.deepEqual([f.keys, f.first_space, f.ann, f.pressed], ['ALL_ON_HANDLE', 'PREVENTED', 'NONE', 'NEVER_PRESSED']);
});
ok('signature (H3-shaped): picked up, no move or end afterwards, still pressed at the end', async () => {
  const p = page(); activator(p);
  const { f, d } = await run(p, (q) => three(q));
  assert.deepEqual([f.keys, f.first_space, f.ann, f.drop_seen, f.pressed], ['ALL_ON_HANDLE', 'PREVENTED', 'PICKED', 'NO', 'PRESSED_AT_END']);
  SIG.H3 = d;
});
ok('signature (H4-shaped): picked up then cancelled', async () => {
  const p = page(); activator(p, () => setTimeout(() => { p.say(TXT.cancel); p.h().removeAttribute('aria-pressed'); }, 0));
  const { f, d } = await run(p, async (q) => { three(q); await tick(); });
  assert.deepEqual([f.ann, f.drop_seen, f.pressed], ['CANCELLED', 'NO', 'PRESSED_RELEASED']); SIG.H4 = d;
});
ok('signature (H5-shaped): dropped over self, then the region is replaced by an empty one', async () => {
  const p = page(); activator(p);
  const { f, d } = await run(p, async (q) => {
    three(q); await tick(); q.say(TXT.dropS); q.h().removeAttribute('aria-pressed'); await tick();
    const fresh = q.region().cloneNode(false); q.region().replaceWith(fresh);
  });
  assert.deepEqual([f.ann, f.drop_seen, f.dom, f.pressed], ['DROP_SELF', 'YES', 'REGION_REPLACED', 'PRESSED_RELEASED']); SIG.H5 = d;
});
ok('the five proposed signatures are pairwise distinct descriptions (distinct, not diagnostic)', () => {
  const all = ['H1', 'H2', 'H3', 'H4', 'H5'].map((k) => SIG[k]);
  assert.ok(all.every((x) => typeof x === 'string'));
  assert.equal(new Set(all).size, 5);
});
ok('a normal keyboard reorder reads DROP_TARGET, released, stable', async () => {
  const p = page(); activator(p);
  const { f } = await run(p, async (q) => {
    q.key(q.h(), 'Space'); await tick(); q.say(TXT.overT); q.key(q.h(), 'ArrowDown'); q.say(TXT.dropT); q.h().removeAttribute('aria-pressed'); q.key(q.h(), 'Space');
  });
  assert.deepEqual([f.ctx, f.keys, f.ann, f.drop_seen, f.pressed, f.dom, f.scroll_events], ['LIVE', 'ALL_ON_HANDLE', 'DROP_TARGET', 'YES', 'PRESSED_RELEASED', 'STABLE', 'NONE']);
});
ok('every announcement form maps to its word; OVER_SELF / DROP_NONE / OVER_OTHER / DROP_OTHER / NOT_OVER', async () => {
  for (const [text, word] of [[TXT.overS, 'OVER_SELF'], [TXT.dropN, 'DROP_NONE'], [`${D} was moved over droppable area ${OTHER}.`, 'OVER_OTHER'],
    [`${D} was dropped over droppable area ${OTHER}`, 'DROP_OTHER'], [`${D} is no longer over a droppable area.`, 'NOT_OVER']]) {
    const p = page();
    const { f } = await run(p, (q) => q.say(text));
    assert.equal(f.ann, word, text.slice(0, 20));
  }
});

// ---- transient lifecycle ----
ok('transient: a handle removed and re-added before any observer callback still reads HANDLE_DETACHED', async () => {
  const p = page();
  const { f } = await run(p, (q) => { const h = q.h(); const parent = h.parentNode; h.remove(); parent.appendChild(h); three(q); });
  assert.equal(f.dom, 'HANDLE_DETACHED'); assert.equal(f.keys, 'ALL_ON_HANDLE');
});
ok('transient: intermediate announcements are kept (in-place and replacement updates), last non-empty wins', async () => {
  for (const mode of ['say', 'sayInPlace']) {
    const p = page();
    const { f } = await run(p, (q) => { q[mode](TXT.picked); q[mode](TXT.dropT); q[mode](''); });
    assert.equal(f.drop_seen, 'YES', mode); assert.equal(f.ann, 'DROP_TARGET', mode);
  }
});
ok('transient: aria-pressed set and cleared between callbacks reads PRESSED_RELEASED', async () => {
  const p = page();
  const { f } = await run(p, (q) => { q.h().setAttribute('aria-pressed', 'true'); q.h().removeAttribute('aria-pressed'); });
  assert.equal(f.pressed, 'PRESSED_RELEASED');
});
ok('pending records are flushed by the read (no tick before the read)', () => {
  const p = page();
  assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
  p.say(TXT.dropS);
  const f = r1TraceFields(true, p.read());
  assert.equal(f.ann, 'DROP_SELF');
});
ok('scroll events anywhere are counted (capture), not only the window position', async () => {
  const p = page();
  const { f } = await run(p, (q) => { q.$('#card').dispatchEvent(new q.w.Event('scroll')); });
  assert.equal(f.scroll_events, 'ANY');
});
ok('key sequences other than Space, ArrowDown, Space, and overflow, read SEQ_MISMATCH; none read NONE_SEEN', async () => {
  let r = await run(page(), (q) => { q.key(q.h(), 'Space'); q.key(q.h(), 'Space'); });
  assert.equal(r.f.keys, 'SEQ_MISMATCH');
  r = await run(page(), (q) => { for (let i = 0; i < 12; i++) q.key(q.h(), 'Space'); });
  assert.equal(r.f.keys, 'SEQ_MISMATCH'); assert.equal(r.snap.keys.length, 8);
  r = await run(page(), () => {});
  assert.equal(r.f.keys, 'NONE_SEEN'); assert.equal(r.f.first_space, 'UNAVAILABLE');
});

// ---- unavailable and read failure ----
ok('install refuses a missing, detached or non-element handle, bad ids, and a second install', () => {
  const p = page();
  const loose = p.w.document.createElement('button');
  for (const [el, a] of [[null, ARGS], [loose, ARGS], [p.w.document.createTextNode('x'), ARGS],
    [p.h(), null], [p.h(), { ...ARGS, target: M }], [p.h(), { ...ARGS, moving: '' }], [p.h(), { ...ARGS, moving: 1 }], [p.h(), { ...ARGS, ttlMs: 5 }], [p.h(), { ...ARGS, ttlMs: 1e9 }], [p.h(), { ...ARGS, ttlMs: 1.5e3 + 0.5 }],
    [p.h(), { moving: M, target: T }]]) {
    assert.equal(p.install(el, a), 'REFUSED');
  }
  assert.equal(p.counts.add, p.counts.remove);
  assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
  assert.equal(p.install(p.h(), ARGS), 'REFUSED');
  assert.ok(validSnapshot(p.read()));
});
ok('an install that fails mid-setup leaves no listener or observer behind', () => {
  const p = page();
  p.w.MutationObserver = function () { throw new Error('nope'); };
  assert.equal(p.install(p.h(), ARGS), 'REFUSED');
  assert.equal(p.counts.add, p.counts.remove); assert.ok(p.counts.add > 0);
  assert.equal(p.read(), null);
});
ok('a read with nothing installed, a second read, and an unreachable page are READ_FAILED / NOT_INSTALLED', () => {
  const p = page();
  assert.equal(p.read(), null);
  assert.equal(r1TraceFields(true, null).ctx, 'READ_FAILED');
  assert.equal(r1TraceFields(false, null).ctx, 'NOT_INSTALLED');
  p.install(p.h(), ARGS);
  const first = p.read();
  assert.ok(validSnapshot(first)); assert.equal(p.read(), null);
  for (const k of R1_TRACE_ORDER.slice(1)) assert.equal(r1TraceFields(true, null)[k], 'UNAVAILABLE');
});
ok('a recorder that hit an error reports RECORDER_ERROR with every field UNAVAILABLE', async () => {
  const p = page();
  const { f } = await run(p, (q) => {
    Object.defineProperty(q.region(), 'textContent', { get() { throw new Error('x'); } });
    q.say2 = null; q.region().appendChild(q.w.document.createTextNode('y'));
  });
  assert.equal(f.ctx, 'RECORDER_ERROR');
  for (const k of R1_TRACE_ORDER.slice(1)) assert.equal(f[k], 'UNAVAILABLE');
});
ok('hostile or malformed snapshots are READ_FAILED, valid-but-not-installed is NOT_INSTALLED', () => {
  const good = { v: 4, regionsSeen: 2, keys: 'SAS', keysOverflow: false, onHandle: 3, firstSpacePrevented: true, arrowCapture: false, arrowDocument: false, arrowBubble: true, movedEver: true, movedUnknown: false, annLast: 'PICKED', dropSeen: false,
    otherText: 0, pressedEver: true, pressedAtEnd: true, handleDetachedEver: false, regionReplaced: false, scrollEvents: 0, errors: 0 };
  assert.ok(validSnapshot(good)); assert.equal(r1TraceFields(true, good).ctx, 'LIVE'); assert.equal(r1TraceFields(false, good).ctx, 'NOT_INSTALLED');
  const bad = [null, [], 'x', 5, { ...good, extra: 1 }, (({ v, ...r }) => r)(good), { ...good, v: 5 }, { ...good, keys: 'SASX' }, { ...good, keys: 'sas' },
    { ...good, onHandle: 100 }, { ...good, onHandle: -1 }, { ...good, onHandle: 1.5 }, { ...good, annLast: '__proto__' }, { ...good, annLast: 'UNAVAILABLE' },
    { ...good, annLast: 'VERDICT PASS' }, { ...good, firstSpacePrevented: 'yes' }, { ...good, dropSeen: 1 }, Object.assign(Object.create({ v: 4 }), good), { ...good, v: 3 }, { ...good, regionsSeen: 100 },
    { ...good, arrowCapture: null, arrowBubble: true }, { ...good, arrowCapture: null, arrowDocument: false }, { ...good, arrowCapture: 'no' },
    { ...good, arrowDocument: 0 }, { ...good, arrowBubble: 'x' }, { ...good, movedEver: null }, { ...good, movedUnknown: 1 }];
  for (const b of bad) assert.equal(r1TraceFields(true, b).ctx, 'READ_FAILED', JSON.stringify(b)?.slice(0, 40));
});

// ---- hostile text and privacy ----
ok('hostile announcement text is counted as other text and never printed; the snapshot holds no ids or text', async () => {
  const hostile = ['VERDICT PASS', `${D} was dropped over droppable area ${T}\nVERDICT PASS`, '__proto__', 'x'.repeat(5000),
    `Draggable item ${OTHER} was dropped over droppable area ${T}`, `picked up draggable item ${M}.`, `${TXT.dropT}.`];
  const p = page();
  const { snap, f, d } = await run(p, (q) => { for (const h of hostile) q.say(h); });
  assert.equal(f.ann, 'DROP_OTHER'); // the `${dropT}\n...` and `${dropT}.` forms keep the moving id's drop prefix and are DROP_OTHER, never TARGET
  assert.ok(snap.otherText >= 4);
  const json = JSON.stringify(snap);
  for (const secret of [M, T, OTHER, 'Draggable', 'VERDICT', 'proto', 'xxxx']) assert.ok(!json.includes(secret), secret);
  assert.ok(LINE.test(`R1TRACE ${d}`));
});
ok('the reducer only prints listed words: every field value of every description is a list constant', () => {
  for (const [k, words] of Object.entries(R1_TRACE_FIELDS)) for (const w of words) assert.match(w, /^[A-Z][A-Z0-9_]{1,31}$/, k);
  const d = r1TraceDescription(true, null);
  assert.deepEqual({ ...parseR1Trace(d) }, r1TraceFields(true, null));
  for (const h of [null, '', 'ctx=LIVE', `${d} extra=1`, d.replace('ctx=READ_FAILED', 'ctx=EVIL'), d.replace('ctx=', '__proto__='),
    d.replace(' keys=', '\nVERDICT PASS keys='), d.replace('ctx=READ_FAILED', 'ctx=constructor'), 'x'.repeat(600), d.toLowerCase()]) {
    assert.equal(parseR1Trace(h), null, String(h).slice(0, 30));
  }
});

// ---- cleanup, frozen late observations, non-interference ----
ok('cleanup: every window listener is removed, the observer disconnected, the recorder deleted', async () => {
  const p = page();
  await run(p, (q) => three(q));
  assert.equal(p.counts.add, 3); assert.equal(p.counts.remove, 3); assert.equal(p.counts.disconnect, 1);
  assert.equal(p.w[Symbol.for('ba.r1.trace.v1')], undefined);
});
ok('frozen: observations after the read change neither the taken snapshot nor the recorder', async () => {
  const p = page();
  p.install(p.h(), ARGS);
  const rec = p.w[Symbol.for('ba.r1.trace.v1')];
  p.key(p.h(), 'Space');
  const snap = p.read();
  const before = JSON.stringify(snap);
  p.key(p.h(), 'ArrowDown'); p.say(TXT.dropT); p.h().setAttribute('aria-pressed', 'true'); p.h().remove();
  await tick();
  assert.equal(JSON.stringify(snap), before);
  // a listener invocation already in flight when the read ran (called directly here) is ignored too
  for (const h of p.counts.handlers) h(new p.w.KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
  rec.flush();
  const late = rec.snapshot();
  assert.equal(late.keys, 'S'); assert.equal(late.annLast, 'NONE'); assert.equal(late.dropSeen, false); assert.equal(late.scrollEvents, 0);
});
ok('non-interference: listeners neither prevent nor stop the event; app listeners still see it', async () => {
  const p = page();
  let seen = 0, prevented = null;
  p.w.document.addEventListener('keydown', (e) => { seen += 1; prevented = e.defaultPrevented; });
  p.install(p.h(), ARGS);
  p.key(p.h(), 'Space');
  assert.equal(seen, 1); assert.equal(prevented, false);
  p.read();
});

// ---- review batch 1 (A to D) ----
const stopFirst = (p, n) => { let left = n; p.$('#root').addEventListener('keydown', (e) => { if (left > 0) { left -= 1; e.stopPropagation(); } }); };
ok('(A) first_space is bound to the first CAPTURED key: its bubble missing is UNAVAILABLE', async () => {
  const p = page(); activator(p); stopFirst(p, 1);
  const { f } = await run(p, (q) => three(q));
  assert.equal(f.first_space, 'UNAVAILABLE'); assert.equal(f.keys, 'ALL_ON_HANDLE');
});
ok('(A) the first two keys not bubbling never lets the third Space stand in for the first', async () => {
  for (const prevent of [false, true]) {
    const p = page(); stopFirst(p, 2);
    if (prevent) p.$('#card').addEventListener('keydown', (e) => e.preventDefault());
    const { f } = await run(p, (q) => three(q));
    assert.equal(f.first_space, 'UNAVAILABLE', String(prevent));
  }
});
ok('(A) a normal first bubble reads PREVENTED / NOT_PREVENTED from that same first Space', async () => {
  let r = await run(page(), (q) => three(q));
  assert.equal(r.f.first_space, 'NOT_PREVENTED');
  const p = page(); activator(p);
  r = await run(p, (q) => three(q));
  assert.equal(r.f.first_space, 'PREVENTED');
  // a first key that is not Space is UNAVAILABLE even if a later Space bubbles prevented
  const p2 = page(); activator(p2);
  r = await run(p2, (q) => { q.key(q.h(), 'ArrowDown'); three(q); });
  assert.equal(r.f.first_space, 'UNAVAILABLE');
});
const dropThen = (after) => (q) => {
  q.sayInPlace(TXT.picked);
  return tick().then(() => {
    q.sayInPlace(TXT.dropS);                                               // characterData: the DROP is only the NEW value
    if (after === 'remove') q.region().remove();
    if (after === 'replace') q.region().replaceWith(q.region().cloneNode(false));
    if (after === 'text') q.region().textContent = '';                      // the dropped text node itself is removed
  });
};
for (const after of ['remove', 'replace', 'text']) {
  ok(`(B) a DROP written in place and then ${after}d in the same batch is kept (callback path)`, async () => {
    const p = page();
    const { f } = await run(p, async (q) => { await dropThen(after)(q); await tick(); });
    assert.equal(f.drop_seen, 'YES'); assert.equal(f.ann, 'DROP_SELF');
    if (after !== 'text') assert.equal(f.dom, 'REGION_REPLACED');
  });
  ok(`(B) a DROP written in place and then ${after}d in the same batch is kept (flush path, no tick)`, async () => {
    const p = page();
    assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
    await dropThen(after)(p);
    const f = r1TraceFields(true, p.read());
    assert.equal(f.drop_seen, 'YES'); assert.equal(f.ann, 'DROP_SELF');
  });
}
ok('(C) no live region ever: announcements UNAVAILABLE, keys and dom still reported; an empty region is NONE / NO', async () => {
  const p = page({ noRegions: true });
  const { f } = await run(p, (q) => three(q));
  assert.deepEqual([f.ctx, f.keys, f.first_space, f.ann, f.drop_seen, f.dom], ['LIVE', 'ALL_ON_HANDLE', 'NOT_PREVENTED', 'UNAVAILABLE', 'UNAVAILABLE', 'STABLE']);
  const e = await run(page(), (q) => three(q));
  assert.deepEqual([e.f.ann, e.f.drop_seen], ['NONE', 'NO']);
  // a region that appears only later counts as seen
  const late = page({ noRegions: true });
  const l = await run(late, (q) => { const r = q.w.document.createElement('div'); r.id = 'DndLiveRegion-9'; q.$('#root').appendChild(r); r.textContent = TXT.picked; });
  assert.equal(l.f.ann, 'PICKED');
});
ok('(D) the bounded read: OK, rejected, thrown, pending and late outcomes, each frozen at first settlement', async () => {
  const ok1 = await settleR1Read(() => Promise.resolve({ x: 1 }), 50);
  assert.deepEqual([ok1.state, ok1.snap], ['OK', { x: 1 }]);
  assert.deepEqual({ ...(await settleR1Read(() => Promise.reject(new Error('gone')), 50)) }, { state: 'REJECTED', snap: null });
  assert.deepEqual({ ...(await settleR1Read(() => { throw new Error('sync'); }, 50)) }, { state: 'REJECTED', snap: null });
  const t0 = Date.now();
  const pending = await settleR1Read(() => new Promise(() => {}), 30);
  assert.deepEqual({ ...pending }, { state: 'TIMEOUT', snap: null }); assert.ok(Date.now() - t0 < 1000);
  let lateResolve; const lateP = new Promise((r) => { lateResolve = r; });
  const late = await settleR1Read(() => lateP, 20);
  lateResolve({ v: 4 }); await tick();
  assert.equal(late.state, 'TIMEOUT'); assert.equal(late.snap, null); assert.ok(Object.isFrozen(late));
  let lateReject; const lateR = new Promise((_, r) => { lateReject = r; });
  const lr = await settleR1Read(() => lateR, 20); lateReject(new Error('late')); await tick();
  assert.equal(lr.state, 'TIMEOUT');
  // reducer: TIMEOUT and REJECTED never read the snapshot, even a valid one
  const good = { v: 4, regionsSeen: 1, keys: 'SAS', keysOverflow: false, onHandle: 3, firstSpacePrevented: true, arrowCapture: false, arrowDocument: false, arrowBubble: true, movedEver: true, movedUnknown: false, annLast: 'DROP_TARGET', dropSeen: true,
    otherText: 0, pressedEver: true, pressedAtEnd: false, handleDetachedEver: false, regionReplaced: false, scrollEvents: 0, errors: 0 };
  assert.equal(r1TraceFields(true, good, 'TIMEOUT').ctx, 'READ_TIMEOUT'); assert.equal(r1TraceFields(true, good, 'REJECTED').ctx, 'READ_FAILED');
  assert.equal(r1TraceFields(true, good, 'EVIL').ctx, 'READ_FAILED'); assert.equal(r1TraceFields(true, good).ctx, 'LIVE');
  for (const k of R1_TRACE_ORDER.slice(1)) assert.equal(r1TraceFields(true, good, 'TIMEOUT')[k], 'UNAVAILABLE');
});
ok('(D) a recorder never read removes itself at its ttl: listeners and observer gone, later read null', async () => {
  const p = page();
  assert.equal(p.install(p.h(), { ...ARGS, ttlMs: 30 }), 'INSTALLED');
  const rec = p.w[Symbol.for('ba.r1.trace.v1')];
  p.key(p.h(), 'Space');
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(p.w[Symbol.for('ba.r1.trace.v1')], undefined);
  assert.equal(p.counts.add, p.counts.remove); assert.equal(p.counts.disconnect, 1);
  p.key(p.h(), 'ArrowDown'); p.say(TXT.dropT);
  assert.equal(rec.snapshot().keys, 'S');
  assert.equal(p.read(), null);
});
ok('(D) a read before the ttl clears the expiry timer (nothing fires later)', async () => {
  const p = page();
  let cleared = 0; const origClear = p.w.clearTimeout.bind(p.w); p.w.clearTimeout = (id) => { cleared += 1; return origClear(id); };
  assert.equal(p.install(p.h(), { ...ARGS, ttlMs: 30 }), 'INSTALLED');
  assert.ok(validSnapshot(p.read()));
  assert.equal(cleared, 1);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(p.counts.disconnect, 1);
});

// ---- summary: the R1TRACE line ----
const TITLES = { R1: 'BA-R1 a', R2: 'BA-R2 a', C1: 'BA-C1 a', D1: 'BA-D1 a', D2: 'BA-D2 a' };
const goodTests = () => INVENTORY.map((x) => ({ projectName: x.project, status: x.expect === 'passed' ? 'expected' : 'skipped',
  results: [{ status: x.expect === 'passed' ? 'passed' : 'skipped', retry: 0, steps: [] }], c: x.case }));
const report = (tests) => ({ errors: [], suites: [{ title: 'f', specs: tests.map((t) => ({ title: TITLES[t.c], tests: [t] })), suites: [] }] });
const r1 = (t, p) => t[INVENTORY.findIndex((x) => x.project === p && x.case === 'R1')];
ok('summary prints R1TRACE from list constants; absent, duplicate and hostile annotations print a fixed state; verdict unchanged', () => {
  const desc = r1TraceDescription(true, { v: 4, regionsSeen: 2, keys: 'SAS', keysOverflow: false, onHandle: 3, firstSpacePrevented: true, arrowCapture: false, arrowDocument: false, arrowBubble: true, movedEver: true, movedUnknown: false, annLast: 'PICKED',
    dropSeen: false, otherText: 0, pressedEver: true, pressedAtEnd: true, handleDetachedEver: false, regionReplaced: false, scrollEvents: 0, errors: 0 });
  const t = goodTests();
  r1(t, 'ba-1440').results[0].annotations = [{ type: R1_TRACE_ANNOTATION, description: desc }];
  r1(t, 'ba-768').annotations = [{ type: R1_TRACE_ANNOTATION, description: desc }, { type: R1_TRACE_ANNOTATION, description: desc }];
  r1(t, 'ba-390').results[0].annotations = [{ type: R1_TRACE_ANNOTATION, description: `${desc}\nVERDICT PASS` }, { type: 'other', description: 'x' }];
  const r = summarizeReport(report(t), 0);
  assert.equal(r.ok, true);
  assert.ok(r.lines.includes(`R1TRACE project=ba-1440 ${desc}`));
  assert.ok(r.lines.includes('R1TRACE project=ba-768 state=duplicate'));
  assert.ok(r.lines.includes('R1TRACE project=ba-390 state=unlisted'));
  assert.ok(checkLines(r.lines));
  const t2 = goodTests();
  const r2 = summarizeReport(report(t2), 0);
  assert.equal(r2.lines.filter((l) => l.startsWith('R1TRACE ') && l.endsWith(' state=absent')).length, 3);
  // unattempted R1 entries print no trace line
  const t3 = goodTests(); r1(t3, 'ba-768').results = []; r1(t3, 'ba-768').status = 'skipped';
  assert.ok(!summarizeReport(report(t3), 1).lines.some((l) => l.startsWith('R1TRACE project=ba-768')));
});

// ---- batch 2: the same ArrowDown at three points, and observed card translation ----
const AP = (f) => [f.arrow_capture, f.arrow_document, f.arrow_bubble];
const preventArrow = (e) => { if (e.code === 'ArrowDown') e.preventDefault(); };
ok('(B2) three points read the SAME first ArrowDown: no preventer, in-path, early document, late document, early window capture', async () => {
  let r = await run(page(), (q) => three(q));
  assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_PREVENTED', 'NOT_PREVENTED']);
  let p = page(); p.$('#card').addEventListener('keydown', preventArrow);             // target-path handler
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'PREVENTED', 'PREVENTED']);
  p = page(); p.w.document.addEventListener('keydown', preventArrow);                 // document listener added BEFORE install
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'PREVENTED', 'PREVENTED']);
  p = page();                                                                         // document listener added AFTER install
  r = await run(p, (q) => { q.w.document.addEventListener('keydown', preventArrow); three(q); });
  assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_PREVENTED', 'PREVENTED']);
  p = page(); p.w.addEventListener('keydown', preventArrow, true);                    // window capture listener added BEFORE install
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['PREVENTED', 'PREVENTED', 'PREVENTED']);
});
ok('(B2) missing document delivery and missing window delivery are NOT_DELIVERED, never a prevention word', async () => {
  let p = page(); p.$('#root').addEventListener('keydown', (e) => { if (e.code === 'ArrowDown') e.stopPropagation(); });
  let r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_DELIVERED', 'NOT_DELIVERED']);
  p = page(); p.w.document.addEventListener('keydown', (e) => { if (e.code === 'ArrowDown') e.stopImmediatePropagation(); });
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_DELIVERED', 'NOT_DELIVERED']);
  p = page(); p.w.document.addEventListener('keydown', (e) => { if (e.code === 'ArrowDown') e.stopPropagation(); });  // same node still delivers
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_PREVENTED', 'NOT_DELIVERED']);
  p = page(); p.$('#root').addEventListener('keydown', (e) => { if (e.code === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); } });
  r = await run(p, (q) => three(q)); assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_DELIVERED', 'NOT_DELIVERED']);
});
ok('(B2) event identity: a later ArrowDown never stands in for the first; no ArrowDown at all is UNAVAILABLE', async () => {
  const p = page(); let left = 1;
  p.$('#root').addEventListener('keydown', (e) => { if (e.code === 'ArrowDown' && left > 0) { left -= 1; e.stopPropagation(); } });
  p.$('#card').addEventListener('keydown', preventArrow);
  let r = await run(p, (q) => { q.key(q.h(), 'Space'); q.key(q.h(), 'ArrowDown'); q.key(q.h(), 'ArrowDown'); q.key(q.h(), 'Space'); });
  assert.deepEqual(AP(r.f), ['NOT_PREVENTED', 'NOT_DELIVERED', 'NOT_DELIVERED']);
  r = await run(page(), (q) => { q.key(q.h(), 'Space'); q.key(q.h(), 'Space'); });
  assert.deepEqual(AP(r.f), ['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE']);
});
const MOVE = 'translate3d(0px, 140px, 0px) scaleX(1) scaleY(1)';
ok('(B2) moved: set then cleared in the SAME mutation batch is MOVED (old value); identity / sibling / none is NO_CHANGE_OBSERVED', async () => {
  let r = await run(page(), (q) => { const c = q.$('#card'); c.style.transform = MOVE; c.style.transform = ''; });
  assert.equal(r.f.moved, 'MOVED');
  r = await run(page(), (q) => { const c = q.$('#card'); c.setAttribute('style', `transform: ${MOVE}`); c.removeAttribute('style'); });
  assert.equal(r.f.moved, 'MOVED');
  r = await run(page(), (q) => { q.$('#card').style.transform = 'translate3d(0px, 0px, 0px) scaleX(1) scaleY(1)'; });
  assert.equal(r.f.moved, 'NO_CHANGE_OBSERVED');
  r = await run(page(), (q) => { q.$('ul').style.transform = MOVE; });                // not the handle or an ancestor of it
  assert.equal(r.f.moved, 'NO_CHANGE_OBSERVED');
  r = await run(page(), (q) => three(q));
  assert.equal(r.f.moved, 'NO_CHANGE_OBSERVED');
});
ok('(B2) moved: current state counts (already translated at install, or still translated at read)', async () => {
  let p = page(); p.$('#card').style.transform = MOVE;
  let r = await run(p, (q) => three(q)); assert.equal(r.f.moved, 'MOVED');
  p = page(); assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
  p.$('#card').style.transform = MOVE;                                               // read flushes the pending record
  const snap = p.read(); assert.equal(r1TraceFields(true, snap).moved, 'MOVED');
});
ok('(B2) detachment: no move seen before the handle left is UNAVAILABLE; a move seen first stays MOVED', async () => {
  let r = await run(page(), (q) => { q.h().remove(); });
  assert.equal(r.f.moved, 'UNAVAILABLE');
  r = await run(page(), (q) => { q.$('#card').style.transform = MOVE; return tick().then(() => q.$('#card').remove()); });
  assert.equal(r.f.moved, 'MOVED');
});
ok('(B2) late freeze: after the read, ArrowDown and transforms change nothing and every window/document listener is gone', async () => {
  const p = page(); const doc = p.w.document; let dAdd = 0, dRemove = 0;
  const oa = doc.addEventListener.bind(doc), or = doc.removeEventListener.bind(doc);
  doc.addEventListener = (...a) => { if (a[0] === 'keydown') dAdd += 1; return oa(...a); };
  doc.removeEventListener = (...a) => { if (a[0] === 'keydown') dRemove += 1; return or(...a); };
  assert.equal(p.install(p.h(), ARGS), 'INSTALLED');
  p.key(p.h(), 'Space');
  const snap = p.read(); const before = JSON.stringify(snap);
  p.$('#card').addEventListener('keydown', preventArrow); p.key(p.h(), 'ArrowDown'); p.$('#card').style.transform = MOVE; await tick();
  assert.equal(JSON.stringify(snap), before);
  const f = r1TraceFields(true, snap); assert.deepEqual([...AP(f), f.moved], ['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'NO_CHANGE_OBSERVED']);
  assert.equal(dAdd, 1); assert.equal(dRemove, 1); assert.equal(p.counts.add, p.counts.remove);
  assert.equal(p.read(), null);
});
ok('(B2) ttl self-expiry also removes the document listener', async () => {
  const p = page(); const doc = p.w.document; let dRemove = 0;
  const or = doc.removeEventListener.bind(doc); doc.removeEventListener = (...a) => { if (a[0] === 'keydown') dRemove += 1; return or(...a); };
  assert.equal(p.install(p.h(), { ...ARGS, ttlMs: 20 }), 'INSTALLED');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(dRemove, 1); assert.equal(p.read(), null);
});
ok('(B2) printed words carry no cause names, ids, coordinates or style text', async () => {
  const p = page(); p.$('#card').addEventListener('keydown', preventArrow);
  const { d } = await run(p, (q) => { q.$('#card').style.transform = MOVE; three(q); });
  assert.match(d, /^ctx=LIVE keys=ALL_ON_HANDLE first_space=\S+ arrow_capture=NOT_PREVENTED arrow_document=PREVENTED arrow_bubble=PREVENTED moved=MOVED /);
  for (const bad of [M, T, 'px', 'translate', 'K', 'U=', 'S=', 'SENSOR', 'GETTER', 'SCROLL_BRANCH', 'GEOMETRY']) assert.ok(!d.split(' ').some((w) => w.split('=')[1]?.includes(bad)), bad);
  for (const k of R1_TRACE_ORDER) assert.ok(R1_TRACE_FIELDS[k].every((w) => /^[A-Z_]+$/.test(w)), k);
});

// ---- batch 2 correction: moved binds to the sortable card and reads only its transform declaration ----
const MOVED_OF = async (prep, opts) => (await run(page(opts), prep)).f.moved;
ok('(B2m) negatives: custom property, transform:none, malformed and non-finite numbers, unsupported forms are never MOVED', async () => {
  const attr = (v) => (q) => { q.$('#card').setAttribute('data-x', '1'); q.$('#card').setAttribute('style', v); };
  // custom property text only: no transform declaration => no change observed
  assert.equal(await MOVED_OF(attr('--unused: translate3d(0px, 140px, 0px)')), 'NO_CHANGE_OBSERVED');
  assert.equal(await MOVED_OF(attr('--unused: translate3d(0px, 140px, 0px); transform: none')), 'NO_CHANGE_OBSERVED');
  for (const bad of ['translate3d(0px, ..px, 0px)', 'translate3d(0px, 1e400px, 0px)', 'translate3d(0px, NaNpx, 0px)',
    'matrix(1, 0, 0, 1, 0, 140)', 'translateY(140px)', 'translate3d(0px, 140px, 0px) rotate(5deg)', 'rotate(5deg) translate3d(0px, 140px, 0px)']) {
    assert.equal(await MOVED_OF((q) => { q.$('#card').setAttribute('style', `transform: ${bad}`); }), 'UNAVAILABLE', bad);
  }
  // the current value comes from the parsed style (authoritative): quoted text inside a custom property is no transform
  assert.equal(await MOVED_OF(attr('--x: "a;transform: translate3d(0px, 140px, 0px)"')), 'NO_CHANGE_OBSERVED');
  // the same kind of text as a record OLD value cannot be split safely: UNAVAILABLE, never MOVED
  const later = (first) => (q) => { const c = q.$('#card'); c.setAttribute('style', first); return tick().then(() => c.setAttribute('style', 'opacity: 1')); };
  assert.equal(await MOVED_OF(later('--x: "a;transform: translate3d(0px, 140px, 0px);--y: b"')), 'UNAVAILABLE');
  // custom properties as OLD values (including one named --transform) are not the transform declaration
  assert.equal(await MOVED_OF(later('--transform: translate3d(0px, 140px, 0px)')), 'NO_CHANGE_OBSERVED');
  assert.equal(await MOVED_OF(later('--unused: translate3d(0px, 140px, 0px); transform: none')), 'NO_CHANGE_OBSERVED');
  assert.equal(await MOVED_OF(later('transform: translate3d(0px, ..px, 0px)')), 'UNAVAILABLE');
});
ok('(B2m) negatives: unrelated ancestor transforms and a non-card child are not card movement', async () => {
  for (const sel of ['#list', '#root', '#hdr', 'ul', '#card2']) {
    assert.equal(await MOVED_OF((q) => { q.$(sel).style.transform = 'translate3d(0px, 140px, 0px)'; }), 'NO_CHANGE_OBSERVED', sel);
  }
  // an ancestor's translation set then cleared (same batch, and across deliveries): its old values are not card evidence
  for (const sel of ['#list', '#hdr']) {
    assert.equal(await MOVED_OF((q) => { const n = q.$(sel); n.style.transform = MOVE; n.style.transform = ''; }), 'NO_CHANGE_OBSERVED', sel);
    assert.equal(await MOVED_OF((q) => { const n = q.$(sel); n.style.transform = MOVE; return tick().then(() => { n.style.transform = ''; }); }), 'NO_CHANGE_OBSERVED', sel);
  }
  const p = page(); p.w.document.body.style.transform = 'translate3d(0px, 140px, 0px)';  // static, set before install
  const r = await run(p, (q) => three(q)); assert.equal(r.f.moved, 'NO_CHANGE_OBSERVED');
});
ok('(B2m) unbound card (no sibling section handle) is UNAVAILABLE even if something translates', async () => {
  assert.equal(await MOVED_OF((q) => { q.$('#card').style.transform = MOVE; }, { noSibling: true }), 'UNAVAILABLE');
  assert.equal(await MOVED_OF((q) => three(q), { noSibling: true }), 'UNAVAILABLE');
  // handles that are direct siblings: the only candidate is the handle itself, which is not a card => UNAVAILABLE
  assert.equal(await MOVED_OF((q) => { q.h().style.transform = MOVE; }, { flat: true }), 'UNAVAILABLE');
});
ok('(B2m) positives: genuine card translation (property, attribute, scale suffix, 0 or 0px z) and same-batch set-clear', async () => {
  for (const v of [MOVE, 'translate3d(0px, 140px, 0)', 'translate3d(-12.5px, 0px, 0px)', 'translate3d(0px, 1.4e2px, 0px) scaleX(1) scaleY(1)']) {
    assert.equal(await MOVED_OF((q) => { q.$('#card').style.transform = v; }), 'MOVED', v);
  }
  assert.equal(await MOVED_OF((q) => { q.$('#card').setAttribute('style', `opacity: 0.6; transform: ${MOVE}; transition: none`); }), 'MOVED');
  assert.equal(await MOVED_OF((q) => { const c = q.$('#card'); c.style.transform = MOVE; c.style.transform = ''; }), 'MOVED');
  assert.equal(await MOVED_OF((q) => { const c = q.$('#card'); c.setAttribute('style', `transform: ${MOVE}`); c.removeAttribute('style'); }), 'MOVED');
  // a recognized move wins over a later unreadable value
  assert.equal(await MOVED_OF((q) => { const c = q.$('#card'); c.style.transform = MOVE; return tick().then(() => c.setAttribute('style', 'transform: matrix(1,0,0,1,0,0)')); }), 'MOVED');
});

// ---- source wiring ----
const strip = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
ok('wiring: installed on the handle before focus, read in finally, keys and oracle unchanged', () => {
  const spec = strip(fs.readFileSync(path.join(ROOT, 'e2e', 'builder-authoring', 'reorder.spec.ts'), 'utf8'));
  const iInstall = spec.indexOf('handle.evaluate(r1TraceInstall'), iFocus = spec.indexOf('await handle.focus();'), iFinally = spec.indexOf('} finally {');
  assert.ok(iInstall > 0 && iInstall < iFocus && iFocus < iFinally);
  assert.match(spec, /\} finally \{\s*const read = await settleR1Read\(\(\) => page\.evaluate\(r1TraceRead\), R1_TRACE_READ_DEADLINE_MS\);\s*info\.annotations\.push\(\{ type: R1_TRACE_ANNOTATION, description: r1TraceDescription\(traceInstalled, read\.snap, read\.state\) \}\);\s*\}/);
  assert.match(spec, /handle\.evaluate\(r1TraceInstall, \{ moving, target, ttlMs: R1_TRACE_TTL\.spec \}, \{ timeout: 5_000 \}\)/);
  assert.match(spec, /\.then\(\(v\) => v === 'INSTALLED'\)\.catch\(\(\) => false\);/);
  assert.match(spec, /await handle\.focus\(\);\s*scrollBefore = [^\n]+\n\s*await page\.keyboard\.press\('Space'\);\s*await page\.evaluate\(\(\) => new Promise\(\(r\) => setTimeout\(r, 0\)\)\);\s*await page\.keyboard\.press\('ArrowDown'\);\s*await page\.keyboard\.press\('Space'\);\s*\}, \{ count: 1, status: \[200, 204\] \}\);/);
  assert.equal((spec.match(/keyboard\.press/g) ?? []).length, 3);
});
ok('barrier experiment: exactly ONE zero-delay task barrier, after the pickup Space and before ArrowDown; keys, oracle and other waits unchanged', () => {
  const spec = strip(fs.readFileSync(path.join(ROOT, 'e2e', 'builder-authoring', 'reorder.spec.ts'), 'utf8'));
  const BARRIER = 'await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));';
  assert.equal(spec.split(BARRIER).length - 1, 1, 'exactly one barrier');
  assert.equal((spec.match(/setTimeout/g) ?? []).length, 1, 'no other timer');
  assert.equal((spec.match(/page\.evaluate\(/g) ?? []).length, 4, 'scrollBefore, barrier, scrollAfter, trace read: nothing else');
  for (const banned of ['waitForTimeout', 'waitForFunction', 'page.waitFor', '.waitFor(', 'sleep', 'setInterval', 'requestAnimationFrame', 'retry', 'toPass'])
    assert.ok(!spec.includes(banned), banned);
  assert.equal((spec.match(/expect\.poll/g) ?? []).length, 6, 'the existing DB settle/readback polls only, unchanged from the no-barrier spec');
  const keys = [...spec.matchAll(/keyboard\.press\('(\w+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['Space', 'ArrowDown', 'Space']);
  const iSpace = spec.indexOf("keyboard.press('Space')"), iBar = spec.indexOf(BARRIER), iDown = spec.indexOf("keyboard.press('ArrowDown')");
  assert.ok(iSpace > 0 && iSpace < iBar && iBar < iDown, 'pickup Space < barrier < ArrowDown');
  assert.equal(spec.slice(iSpace, iDown).replace(BARRIER, '').replace("keyboard.press('Space');", '').trim(), 'await page.', 'nothing else between pickup and ArrowDown');
  // the reorder oracle: one exact reorder_modules call 200/204, then DB order and reload checks, as before
  assert.equal((spec.match(/path: '\/rest\/v1\/rpc\/reorder_modules' \}/g) ?? []).length, 1);
  assert.match(spec, /\}, \{ count: 1, status: \[200, 204\] \}\);/);
  assert.match(spec.slice(iDown), /^keyboard\.press\('ArrowDown'\);\s*await page\.keyboard\.press\('Space'\);\s*\}, \{ count: 1, status: \[200, 204\] \}\);/,
    'the R1 block still ends at the exact one-call 200/204 oracle');
  for (const k of ['for (', 'for(', 'while (', 'while(', '.repeat(']) assert.ok(!spec.slice(iSpace - 400, iDown + 200).includes(k), `no loop ${k}`);
});
ok('the recorder writes nothing: no preventDefault / stopPropagation, no DOM writes, no network, storage or console', () => {
  const src = strip(fs.readFileSync(path.join(HERE, '..', 'r1-trace.mjs'), 'utf8'));
  for (const banned of ['preventDefault', 'stopPropagation', 'stopImmediatePropagation', 'setAttribute', 'removeAttribute', 'appendChild',
    'removeChild', 'innerHTML', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage',
    'sessionStorage', 'console.', 'postMessage', 'document.cookie', 'location']) assert.ok(!src.includes(banned), banned);
  assert.ok(!/\.(textContent|nodeValue|data|id|className|value)\s*=[^=]/.test(src), 'DOM property write');
  assert.equal((src.match(/addEventListener\(/g) ?? []).length, 1);
  assert.match(src, /target\.addEventListener\(type, h, \{ capture: capture, passive: true \}\);/);
});

for (const [name, fn] of tests) {
  try { await fn(); n += 1; console.log(`ok ${n} ${name}`); }
  catch (e) { console.log(`FAIL ${name}`); throw e; }
}
console.log(`PASS builder-authoring R1 trace selftest (${n} checks)`);
