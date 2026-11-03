#!/usr/bin/env node
// ABOUTME: Fake-DOM controls (jsdom) for the passive R1 trace: the page functions run from their own source text, as
// ABOUTME: Playwright sends them. Proposed signatures are told apart; none is claimed to be a diagnosis of a cause.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { r1TraceInstall, r1TraceRead, r1TraceFields, r1TraceDescription, parseR1Trace, validSnapshot, R1_TRACE_FIELDS,
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
const TXT = {
  picked: `Picked up draggable item ${M}.`, overT: `${D} was moved over droppable area ${T}.`, overS: `${D} was moved over droppable area ${M}.`,
  dropT: `${D} was dropped over droppable area ${T}`, dropS: `${D} was dropped over droppable area ${M}`, dropN: `${D} was dropped.`,
  cancel: `Dragging was cancelled. ${D} was dropped.`,
};

/** A fake page: a handle button inside a card, the outer live region and one inner (lesson) region. */
function page() {
  const dom = new JSDOM(`<!doctype html><body><div id="root"><div id="card"><span><button id="h" aria-label="Reorder section"></button></span>
    <ul></ul></div><div id="DndLiveRegion-0" role="status"></div><div id="DndLiveRegion-1" role="status"></div></div></body>`,
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
  assert.equal(p.install(p.h(), { moving: M, target: T }), 'INSTALLED');
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
  assert.equal(p.install(p.h(), { moving: M, target: T }), 'INSTALLED');
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
  for (const [el, a] of [[null, { moving: M, target: T }], [loose, { moving: M, target: T }], [p.w.document.createTextNode('x'), { moving: M, target: T }],
    [p.h(), null], [p.h(), { moving: M, target: M }], [p.h(), { moving: '', target: T }], [p.h(), { moving: 1, target: T }]]) {
    assert.equal(p.install(el, a), 'REFUSED');
  }
  assert.equal(p.counts.add, p.counts.remove);
  assert.equal(p.install(p.h(), { moving: M, target: T }), 'INSTALLED');
  assert.equal(p.install(p.h(), { moving: M, target: T }), 'REFUSED');
  assert.ok(validSnapshot(p.read()));
});
ok('an install that fails mid-setup leaves no listener or observer behind', () => {
  const p = page();
  p.w.MutationObserver = function () { throw new Error('nope'); };
  assert.equal(p.install(p.h(), { moving: M, target: T }), 'REFUSED');
  assert.equal(p.counts.add, p.counts.remove); assert.ok(p.counts.add > 0);
  assert.equal(p.read(), null);
});
ok('a read with nothing installed, a second read, and an unreachable page are READ_FAILED / NOT_INSTALLED', () => {
  const p = page();
  assert.equal(p.read(), null);
  assert.equal(r1TraceFields(true, null).ctx, 'READ_FAILED');
  assert.equal(r1TraceFields(false, null).ctx, 'NOT_INSTALLED');
  p.install(p.h(), { moving: M, target: T });
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
  const good = { v: 1, keys: 'SAS', keysOverflow: false, onHandle: 3, firstSpacePrevented: true, annLast: 'PICKED', dropSeen: false,
    otherText: 0, pressedEver: true, pressedAtEnd: true, handleDetachedEver: false, regionReplaced: false, scrollEvents: 0, errors: 0 };
  assert.ok(validSnapshot(good)); assert.equal(r1TraceFields(true, good).ctx, 'LIVE'); assert.equal(r1TraceFields(false, good).ctx, 'NOT_INSTALLED');
  const bad = [null, [], 'x', 5, { ...good, extra: 1 }, (({ v, ...r }) => r)(good), { ...good, v: 2 }, { ...good, keys: 'SASX' }, { ...good, keys: 'sas' },
    { ...good, onHandle: 100 }, { ...good, onHandle: -1 }, { ...good, onHandle: 1.5 }, { ...good, annLast: '__proto__' }, { ...good, annLast: 'UNAVAILABLE' },
    { ...good, annLast: 'VERDICT PASS' }, { ...good, firstSpacePrevented: 'yes' }, { ...good, dropSeen: 1 }, Object.assign(Object.create({ v: 1 }), good)];
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
  p.install(p.h(), { moving: M, target: T });
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
  p.install(p.h(), { moving: M, target: T });
  p.key(p.h(), 'Space');
  assert.equal(seen, 1); assert.equal(prevented, false);
  p.read();
});

// ---- summary: the R1TRACE line ----
const TITLES = { R1: 'BA-R1 a', R2: 'BA-R2 a', C1: 'BA-C1 a', D1: 'BA-D1 a', D2: 'BA-D2 a' };
const goodTests = () => INVENTORY.map((x) => ({ projectName: x.project, status: x.expect === 'passed' ? 'expected' : 'skipped',
  results: [{ status: x.expect === 'passed' ? 'passed' : 'skipped', retry: 0, steps: [] }], c: x.case }));
const report = (tests) => ({ errors: [], suites: [{ title: 'f', specs: tests.map((t) => ({ title: TITLES[t.c], tests: [t] })), suites: [] }] });
const r1 = (t, p) => t[INVENTORY.findIndex((x) => x.project === p && x.case === 'R1')];
ok('summary prints R1TRACE from list constants; absent, duplicate and hostile annotations print a fixed state; verdict unchanged', () => {
  const desc = r1TraceDescription(true, { v: 1, keys: 'SAS', keysOverflow: false, onHandle: 3, firstSpacePrevented: true, annLast: 'PICKED',
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

// ---- source wiring ----
const strip = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
ok('wiring: installed on the handle before focus, read in finally, keys and oracle unchanged', () => {
  const spec = strip(fs.readFileSync(path.join(ROOT, 'e2e', 'builder-authoring', 'reorder.spec.ts'), 'utf8'));
  const iInstall = spec.indexOf('handle.evaluate(r1TraceInstall'), iFocus = spec.indexOf('await handle.focus();'), iFinally = spec.indexOf('} finally {');
  assert.ok(iInstall > 0 && iInstall < iFocus && iFocus < iFinally);
  assert.match(spec, /\} finally \{\s*const snap = await page\.evaluate\(r1TraceRead\)\.catch\(\(\) => null\);\s*info\.annotations\.push\(\{ type: R1_TRACE_ANNOTATION, description: r1TraceDescription\(traceInstalled, snap\) \}\);\s*\}/);
  assert.match(spec, /\.then\(\(v\) => v === 'INSTALLED'\)\.catch\(\(\) => false\);/);
  assert.match(spec, /await handle\.focus\(\);\s*scrollBefore = [^\n]+\n\s*await page\.keyboard\.press\('Space'\);\s*await page\.keyboard\.press\('ArrowDown'\);\s*await page\.keyboard\.press\('Space'\);\s*\}, \{ count: 1, status: \[200, 204\] \}\);/);
  assert.equal((spec.match(/keyboard\.press/g) ?? []).length, 3);
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
