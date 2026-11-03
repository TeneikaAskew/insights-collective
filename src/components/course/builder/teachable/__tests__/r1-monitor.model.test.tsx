// ABOUTME: r1-monitor model + controls (diagnostic, source/fake only): REAL CurriculumView/DndContext/KeyboardSensor with the REAL
// ABOUTME: r1-trace and r1-monitor page functions in jsdom, React's own scheduler, plus fake-fiber fault controls. Base harness:: REAL CurriculumView + DndContext + KeyboardSensor and the
// ABOUTME: REAL r1-trace recorder in jsdom, with React's REAL scheduler (no act() flushing) and native key events.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MemoryRouter } from 'react-router-dom';
import { CurriculumView } from '../CurriculumView';
import { r1TraceInstall, r1TraceRead, r1TraceFields, settleR1Read } from '../../../../../../scripts/builder-authoring-fixture/r1-trace.mjs';
import { r1MonitorInstall, r1MonitorRead, r1MonitorFields, validMonitorSnapshot } from '../../../../../../scripts/builder-authoring-fixture/r1-monitor.mjs';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const A = 'sec-a', B = 'sec-b', C = 'sec-c';
const lesson = (id: string) => ({ id, title: id, type: 'text', published: true } as any);
const MODULES = [
  { id: A, title: 'One', items: [lesson('l1'), lesson('l2'), lesson('l3')] },
  { id: B, title: 'Two', items: [lesson('l4')] },
  { id: C, title: 'Three', items: [lesson('l5')] },
] as any[];

/** Synthetic layout (geometry stays OPEN): only the section cards get rects; the page does not scroll. */
const GAP = 20, TOP = 200, LEFT = 100, WIDTH = 900;
let heights: number[];
const orig = Element.prototype.getBoundingClientRect;
function rects(this: Element) {
  const parent = this.parentElement;
  if (parent && parent.className === 'space-y-5') {
    const i = Array.prototype.indexOf.call(parent.children, this);
    let top = TOP; for (let k = 0; k < i; k++) top += heights[k] + GAP;
    const h = heights[i];
    return { x: LEFT, y: top, top, left: LEFT, width: WIDTH, height: h, bottom: top + h, right: LEFT + WIDTH, toJSON() {} } as DOMRect;
  }
  return orig.call(this);
}
beforeEach(() => { heights = [170 + 3 * 52, 170 + 52, 170 + 52]; Element.prototype.getBoundingClientRect = rects; });
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = orig; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });

/** Task-level controls. microtasks(): only the current task's microtasks run (React SyncLane work flushes here).
 *  macrotask(): one scheduler task (React's Scheduler uses setImmediate in Node, MessageChannel in a browser) plus one
 *  timer task, so DefaultLane work (dnd-kit's setOver from its passive effect) and equal-delay timers can run. */
const microtasks = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const macrotask = () => new Promise<void>((r) => setImmediate(() => setTimeout(r, 0)));
const key = (h: HTMLElement, code: 'Space' | 'ArrowDown') => {
  const k = code === 'Space' ? ' ' : code;
  h.dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true }));
  h.dispatchEvent(new KeyboardEvent('keyup', { code, key: k, bubbles: true, cancelable: true }));
};

const K = Symbol.for('ba.r1.monitor.v1');
const h = (el: HTMLElement, code: string) => el.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
type Opt = { afterArrow: 'microtasks' | 'macrotask'; monitor?: boolean; escape?: boolean; remount?: boolean };
const view = (calls: string[][], k = 'a') => (<MemoryRouter key={k}><TooltipProvider><CurriculumView courseTitle="T" modules={MODULES} onAddModule={vi.fn()}
  onRenameModule={vi.fn()} onDeleteModule={vi.fn()} onReorderModules={(ids) => calls.push(ids)} onAddLesson={vi.fn()}
  onRenameLesson={vi.fn()} onDeleteLesson={vi.fn()} onTogglePublishLesson={vi.fn()} onReorderLessons={vi.fn()}
  onSelectLesson={vi.fn()} /></TooltipProvider></MemoryRouter>);
async function drive(o: Opt) {
  const calls: string[][] = [];
  const r = render(view(calls));
  await act(async () => { await macrotask(); });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
  const handle = r.getAllByRole('button', { name: 'Reorder section' })[0];
  const installed = r1TraceInstall(handle, { moving: A, target: B, ttlMs: 60000 }) === 'INSTALLED';
  const mon = o.monitor === false ? 'NOT_INSTALLED' : r1MonitorInstall(handle, { moving: A, target: B, ttlMs: 60000 });
  handle.focus();
  key(handle, 'Space'); await microtasks(); await macrotask();     // the spec's one pickup barrier
  key(handle, 'ArrowDown'); await microtasks();
  if (o.afterArrow === 'macrotask') await macrotask();
  if (o.escape) h(handle, 'Escape'); else key(handle, 'Space');
  await microtasks(); for (let i = 0; i < 5; i++) await macrotask();
  if (o.remount) { r.rerender(view(calls, 'b')); await microtasks(); await macrotask(); }
  const trace = r1TraceFields(installed, structuredClone(r1TraceRead()));
  const monitor = r1MonitorFields(mon, structuredClone(r1MonitorRead()));
  return { calls, trace, monitor, installed: mon };
}
const RUN = { ctx: 'LIVE', keys: 'ALL_ON_HANDLE', first_space: 'PREVENTED', arrow_capture: 'NOT_PREVENTED', arrow_document: 'NOT_PREVENTED',
  arrow_bubble: 'PREVENTED', moved: 'MOVED', ann: 'DROP_SELF', drop_seen: 'YES', pressed: 'PRESSED_RELEASED', dom: 'STABLE', scroll_events: 'NONE' };
const log = (n: string, r: any) => console.log(`MODEL ${n} ${JSON.stringify(r)}`);
const W = (r: any) => [r.monitor.ctx, r.monitor.seq, r.monitor.move_collision, r.monitor.over_requested, r.monitor.end, r.monitor.end_over];
afterEach(() => { r1MonitorRead(); try { delete (window as any)[K]; } catch { /* C13 leaves a non-configurable slot by design */ } });

describe('r1-monitor on the real component (no DevTools hook in this harness, as in the served production copy)', () => {
  it('H0 no DevTools hook is present here', () => { expect((globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__).toBeUndefined(); });
  it('M1 no task before final Space: move TARGET, over_requested TARGET (dispatched), end DROP with end_over SELF; 12 run words, 0 calls', async () => {
    const r = await drive({ afterArrow: 'microtasks' }); log('M1', r);
    expect(r.installed).toBe('INSTALLED'); expect(r.trace).toEqual(RUN); expect(r.calls).toEqual([]);
    expect(W(r)).toEqual(['LIVE', 'BOUND', 'TARGET', 'TARGET', 'DROP', 'SELF']);
  });
  it('M2 one task: end_over TARGET, one [B,A,C]', async () => {
    const r = await drive({ afterArrow: 'macrotask' }); log('M2', r);
    expect(W(r)).toEqual(['LIVE', 'BOUND', 'TARGET', 'TARGET', 'DROP', 'TARGET']); expect(r.calls).toEqual([[B, A, C]]);
  });
  it('M3 tall source: move SELF, no over request, end_over SELF', async () => {
    heights = [900, 120, 120];
    const r = await drive({ afterArrow: 'macrotask' }); log('M3', r);
    expect(W(r)).toEqual(['LIVE', 'BOUND', 'SELF', 'NONE', 'DROP', 'SELF']); expect(r.trace).toEqual(RUN);
  });
  it('M4 Escape: key binding mismatches, but the actual cancel is CANCELLED with end_over UNKNOWN', async () => {
    const r = await drive({ afterArrow: 'microtasks', escape: true }); log('M4', r);
    expect(W(r)).toEqual(['LIVE', 'SEQ_MISMATCH', 'UNKNOWN', 'UNKNOWN', 'CANCELLED', 'UNKNOWN']); expect(r.calls).toEqual([]);
  });
  it('M5 on/off preservation: identical trace words and calls with and without the observer', async () => {
    for (const afterArrow of ['microtasks', 'macrotask'] as const) {
      const on = await drive({ afterArrow }); cleanup();
      const off = await drive({ afterArrow, monitor: false }); cleanup();
      log(`M5-${afterArrow}`, { on: on.trace, off: off.trace, onCalls: on.calls, offCalls: off.calls });
      expect(on.trace).toEqual(off.trace); expect(on.calls).toEqual(off.calls); expect(off.monitor.ctx).toBe('NOT_INSTALLED');
    }
  });
  it('M6 remount before the read: CONTINUITY_BROKEN, every word UNKNOWN', async () => {
    const r = await drive({ afterArrow: 'microtasks', remount: true }); log('M6', r);
    expect(r.monitor.ctx).toBe('CONTINUITY_BROKEN'); expect(r.monitor.end_over).toBe('UNKNOWN');
  });
});

/** Fake fibers in the pinned shape (core 6.3.1) and a fake monitor with the library's Set semantics. */
const PUB = ['active', 'activeNode', 'activeNodeRect', 'activatorEvent', 'collisions', 'containerNodeRect', 'dragOverlay', 'draggableNodes',
  'droppableContainers', 'droppableRects', 'over', 'measureDroppableContainers', 'scrollableAncestors', 'scrollableAncestorRects',
  'measuringConfiguration', 'measuringScheduled', 'windowRect'];
const INT = ['activatorEvent', 'activators', 'active', 'activeNodeRect', 'ariaDescribedById', 'dispatch', 'draggableNodes', 'over', 'measureDroppableContainers'];
function lib(o: { unreg?: 'ok' | 'false' | 'throw' | 'none'; regThrows?: boolean } = {}) {
  const set = new Set<any>(); const stats = { regCalls: 0 };
  const reg = function (listener: any) {
    stats.regCalls++;
    if (o.regThrows) throw new Error('reg');
    set.add(listener);
    if (o.unreg === 'none') return undefined;
    return () => { if (o.unreg === 'throw') throw new Error('unreg'); const d = set.delete(listener); return o.unreg === 'false' ? false : d; };
  };
  const dispatch = (type: string, event: any) => set.forEach((l) => l[type]?.call(l, event));
  return { set, reg, dispatch, stats };
}
function tree(el: HTMLElement, reg: any, o: { pubKeys?: string[]; intKeys?: string[]; holdsTarget?: boolean; nested?: boolean; alt?: any; expandos?: number; monLen?: number } = {}) {
  const obj = (ks: string[], extra: any = {}) => Object.fromEntries(ks.map((k) => [k, extra[k] ?? null]));
  const containers = new Map<string, any>([[A, {}], ...(o.holdsTarget === false ? [] : [[B, {}]] as any)]);
  const pubV = obj(o.pubKeys ?? PUB, { droppableContainers: containers });
  const mon: any = { tag: 10, memoizedProps: { value: o.monLen === 2 ? (x: any, y: any) => reg(x) : reg }, return: null, alternate: o.alt === undefined ? null : { memoizedProps: { value: o.alt } } };
  const int: any = { tag: 10, memoizedProps: { value: obj(o.intKeys ?? INT) }, return: mon };
  const pub: any = { tag: 10, memoizedProps: { value: pubV }, return: int };
  if (o.nested) { const outerPub: any = { tag: 10, memoizedProps: { value: obj(PUB, { droppableContainers: containers }) }, return: null }; mon.return = outerPub; }
  const host: any = { tag: 5, memoizedProps: {}, return: { tag: 0, return: pub } };
  for (let i = 0; i < (o.expandos ?? 1); i++) (el as any)[`__reactFiber$k${i}`] = host;
}
describe('r1-monitor controls (fake fibers, fake monitor, real install/read)', () => {
  let el: HTMLElement;
  beforeEach(() => { document.body.innerHTML = '<button id="h"></button><button id="o"></button>'; el = document.getElementById('h')!; });
  const opts = { moving: A, target: B, ttlMs: 60000 };
  const kd = (code: string, t: Element = el) => t.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  const P1 = (L: any) => { kd('Space'); L.dispatch('onDragOver', { over: { id: A } }); kd('ArrowDown'); L.dispatch('onDragMove', { collisions: [{ id: B }] });
    L.dispatch('onDragOver', { over: { id: B } }); kd('Space'); L.dispatch('onDragEnd', { over: { id: A } }); };
  const fields = (ins: string) => r1MonitorFields(ins, structuredClone(r1MonitorRead()));

  it('C0 base: exact ancestry INSTALLED; P1-shaped events give TARGET/TARGET/DROP/SELF; one listener registered, removed at read', () => {
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts);
    expect(ins).toBe('INSTALLED'); expect(L.set.size).toBe(1); P1(L);
    expect(fields(ins)).toEqual({ ctx: 'LIVE', seq: 'BOUND', move_collision: 'TARGET', over_requested: 'TARGET', end: 'DROP', end_over: 'SELF' });
    expect(L.set.size).toBe(0); expect(Object.prototype.hasOwnProperty.call(window, K)).toBe(false);
  });
  it('C1 ancestry and identity are validated BEFORE registration: drift/ambiguity => NOT_FOUND and nothing registered', () => {
    const cases: any[] = [{ pubKeys: PUB.slice(1) }, { pubKeys: [...PUB, 'extra'] }, { intKeys: INT.slice(1) }, { holdsTarget: false }, { nested: true },
      { alt: () => 0 }, { expandos: 2 }, { expandos: 0 }, { monLen: 2 }];
    for (const c of cases) {
      document.body.innerHTML = '<button id="h"></button>'; el = document.getElementById('h')!;
      const L = lib(); tree(el, L.reg, c); expect(r1MonitorInstall(el, opts)).toBe('NOT_FOUND'); expect(L.stats.regCalls).toBe(0); expect(L.set.size).toBe(0);
      expect(Object.prototype.hasOwnProperty.call(window, K)).toBe(false);
    }
    expect(r1MonitorFields('NOT_FOUND', null)).toMatchObject({ ctx: 'NOT_FOUND', end_over: 'UNKNOWN' });
  });
  it('C2 registration faults roll back: reg throws; unregister missing (listener inert); addEventListener, setTimeout, slot write throw', () => {
    { const L = lib({ regThrows: true }); tree(el, L.reg); expect(r1MonitorInstall(el, opts)).toBe('REFUSED'); expect(L.set.size).toBe(0); }
    { const L = lib({ unreg: 'none' }); tree(el, L.reg); expect(r1MonitorInstall(el, opts)).toBe('REFUSED');
      const [l] = [...L.set]; l.onDragEnd({ over: { id: A } }); expect(Object.prototype.hasOwnProperty.call(window, K)).toBe(false); }
    const faults: [string, () => () => void][] = [
      ['addEventListener', () => { const o = window.addEventListener; (window as any).addEventListener = () => { throw new Error('x'); }; return () => { window.addEventListener = o; }; }],
      ['setTimeout', () => { const o = window.setTimeout; (window as any).setTimeout = () => { throw new Error('x'); }; return () => { window.setTimeout = o; }; }],
      ['slot', () => { const proto = Object.getPrototypeOf(window); Object.defineProperty(proto, K, { configurable: true, set() { /* ignore */ }, get() { return undefined; } }); return () => { delete proto[K]; }; }],
    ];
    for (const [name, inject] of faults) {
      const L = lib(); tree(el, L.reg); const undo = inject(); let ins: string;
      try { ins = r1MonitorInstall(el, opts); } finally { undo(); }
      expect(ins, name).toBe('REFUSED'); expect(L.set.size, name).toBe(0); expect(Object.prototype.hasOwnProperty.call(window, K), name).toBe(false);
    }
  });
  it('C3 unregister validated: false or throwing => OBSERVER_ERROR; other cleanups still run (key listener off, timer cleared)', async () => {
    for (const u of ['false', 'throw'] as const) {
      const L = lib({ unreg: u }); tree(el, L.reg); const ins = r1MonitorInstall(el, { ...opts, ttlMs: 30 }); P1(L);
      const rm = vi.spyOn(window, 'removeEventListener'), ct = vi.spyOn(window, 'clearTimeout');
      expect(fields(ins).ctx).toBe('OBSERVER_ERROR');
      expect(rm.mock.calls.filter((c) => c[0] === 'keydown').length).toBe(1); expect(ct).toHaveBeenCalledTimes(1); rm.mockRestore(); ct.mockRestore();
      await new Promise((r) => setTimeout(r, 50)); expect(r1MonitorRead()).toBeNull();   // ttl timer did not resurrect anything
    }
    { const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); const o = window.removeEventListener;
      (window as any).removeEventListener = () => { throw new Error('x'); };
      try { P1(L); expect(fields(ins).ctx).toBe('OBSERVER_ERROR'); } finally { window.removeEventListener = o; }
      expect(L.set.size).toBe(0); }                                     // unregister still happened
  });
  it('C4 existing slot of any owner: REFUSED, foreign slot untouched; hostile foreign read => READ_FAILED', () => {
    const foreign = { read: () => ({ v: 1, hostile: true }) }; (window as any)[K] = foreign;
    const L = lib(); tree(el, L.reg); expect(r1MonitorInstall(el, opts)).toBe('REFUSED'); expect(L.stats.regCalls).toBe(0);   // refused before any registration
    expect(L.set.size).toBe(0); expect((window as any)[K]).toBe(foreign);
    expect(r1MonitorFields('INSTALLED', r1MonitorRead()).ctx).toBe('READ_FAILED'); delete (window as any)[K];
  });
  it('C5 idempotent read/cleanup and TTL: second read null; LATE after ttl, then null; post-timeout callbacks inert', async () => {
    { const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); P1(L); expect(fields(ins).ctx).toBe('LIVE'); expect(r1MonitorRead()).toBeNull(); }
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, { ...opts, ttlMs: 20 }); const [l] = [...L.set];
    kd('Space'); kd('ArrowDown'); await new Promise((r) => setTimeout(r, 50));
    expect(L.set.size).toBe(0);                                         // ttl released the listener
    l.onDragEnd({ over: { id: B } }); kd('Space');                      // late callbacks and keys: inert
    const snap = r1MonitorRead(); expect(validMonitorSnapshot(snap)).toBe(true); expect(snap.drops).toBe(0);
    expect(r1MonitorFields(ins, snap).ctx).toBe('LATE'); expect(r1MonitorRead()).toBeNull();
  });
  it('C6 an observer fault never skips later library listeners; another listener throwing is left exactly as the library does', () => {
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); const seen: string[] = [];
    L.set.add({ onDragMove: () => seen.push('later') });
    kd('Space'); kd('ArrowDown');
    L.dispatch('onDragMove', { get collisions() { throw new Error('hostile'); } });
    expect(seen).toEqual(['later']); expect(fields(ins).ctx).toBe('OBSERVER_ERROR');
    const L2 = lib(); tree(el, L2.reg); r1MonitorInstall(el, opts); L2.set.clear();   // only foreign listeners from here
    L2.set.add({ onDragEnd: () => { throw new Error('foreign'); } });
    expect(() => L2.dispatch('onDragEnd', {})).toThrow('foreign');
  });
  it('C7 bounded work: 1000 events and keys keep counters capped and the snapshot the same size', () => {
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); kd('Space'); kd('ArrowDown');
    for (let i = 0; i < 1000; i++) { L.dispatch('onDragMove', { collisions: [{ id: B }] }); L.dispatch('onDragOver', { over: { id: B } }); }
    for (let i = 0; i < 1000; i++) { kd('ArrowDown'); kd('Space', document.getElementById('o')!); }
    const snap = r1MonitorRead(); expect(snap.moves).toBe(9); expect(snap.overs).toBe(9); expect(snap.off).toBeLessThanOrEqual(9); expect(snap.keysOver).toBe(true); expect(snap.keys.length).toBe(8);   // key tracking stopped at saturation
    expect(JSON.stringify(snap).length).toBeLessThan(260); expect(r1MonitorFields(ins, snap)).toMatchObject({ seq: 'SEQ_MISMATCH', end_over: 'UNKNOWN' });
  });
  it('C8 word rules: early end, multiple ends, two moves, two over requests, null over, no events', () => {
    const run = (steps: (L: any) => void) => { const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); steps(L); return fields(ins); };
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragEnd', { over: { id: A } }); kd('Space'); }).end).toBe('UNKNOWN');
    expect(run((L) => { kd('Space'); kd('ArrowDown'); kd('Space'); L.dispatch('onDragEnd', { over: { id: A } }); L.dispatch('onDragEnd', { over: { id: A } }); })).toMatchObject({ end: 'MULTIPLE', end_over: 'UNKNOWN' });
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragMove', { collisions: [{ id: B }] }); L.dispatch('onDragMove', { collisions: [{ id: B }] }); kd('Space'); }).move_collision).toBe('UNKNOWN');
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragOver', { over: { id: B } }); L.dispatch('onDragOver', { over: { id: C } }); kd('Space'); }).over_requested).toBe('MULTIPLE');
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragOver', { over: null }); kd('Space'); }).over_requested).toBe('NULL');
    expect(run(() => { kd('Space'); kd('ArrowDown'); kd('Space'); })).toMatchObject({ move_collision: 'UNKNOWN', over_requested: 'NONE', end: 'NONE', end_over: 'UNKNOWN' });
  });
  it('C9 Node-side read deadline freezes the output: a never-settling read is READ_TIMEOUT', async () => {
    const r = await settleR1Read(() => new Promise(() => {}), 30);
    expect(r1MonitorFields('INSTALLED', r.snap, r.state).ctx).toBe('READ_TIMEOUT');
  });
  it('C10 a cancel before the final Space (pickup or after Arrow) stays CANCELLED with end_over UNKNOWN; early DROP and several ends stay conservative', () => {
    const run = (steps: (L: any) => void) => { const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); steps(L); return fields(ins); };
    expect(run((L) => { kd('Space'); L.dispatch('onDragCancel', {}); kd('ArrowDown'); kd('Space'); }))
      .toEqual({ ctx: 'LIVE', seq: 'BOUND', move_collision: 'UNKNOWN', over_requested: 'NONE', end: 'CANCELLED', end_over: 'UNKNOWN' });
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragMove', { collisions: [{ id: B }] }); L.dispatch('onDragCancel', {}); kd('Space'); }))
      .toMatchObject({ seq: 'BOUND', move_collision: 'TARGET', end: 'CANCELLED', end_over: 'UNKNOWN' });
    expect(run((L) => { L.dispatch('onDragCancel', {}); kd('Space'); kd('ArrowDown'); kd('Space'); })).toMatchObject({ end: 'CANCELLED', end_over: 'UNKNOWN' });
    expect(run((L) => { kd('Space'); kd('ArrowDown'); L.dispatch('onDragEnd', { over: { id: A } }); kd('Space'); })).toMatchObject({ end: 'UNKNOWN', end_over: 'UNKNOWN' });
    expect(run((L) => { kd('Space'); L.dispatch('onDragCancel', {}); kd('ArrowDown'); kd('Space'); L.dispatch('onDragEnd', { over: { id: A } }); }))
      .toMatchObject({ end: 'MULTIPLE', end_over: 'UNKNOWN' });
  });
  it('C11 slot deletion outcome: normal, idempotent and TTL cleanup report slot Y; frozen observations are unchanged by the read', async () => {
    { const L = lib(); tree(el, L.reg); r1MonitorInstall(el, opts); P1(L); const s1 = r1MonitorRead();
      expect(s1.slot).toBe('Y'); expect(Object.prototype.hasOwnProperty.call(window, K)).toBe(false); expect(r1MonitorRead()).toBeNull(); }
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, { ...opts, ttlMs: 20 }); await new Promise((r) => setTimeout(r, 50));
    const s2 = r1MonitorRead(); expect(s2.slot).toBe('Y'); expect(r1MonitorFields(ins, s2).ctx).toBe('LATE'); expect(r1MonitorRead()).toBeNull();
  });
  it('C12 slot deletion that throws, returns false, or reports success without removing: OBSERVER_ERROR; observations identical to the normal read; slot still reported on a repeat read', () => {
    const base = (() => { const L = lib(); tree(el, L.reg); r1MonitorInstall(el, opts); P1(L); return r1MonitorRead(); })();
    for (const mode of ['throw', 'false', 'lie'] as const) {
      const real = window; const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, opts); P1(L);
      const prox = new Proxy(real, { deleteProperty: (t, k) => { if (k === K) { if (mode === 'throw') throw new TypeError('x'); return mode === 'lie'; } return Reflect.deleteProperty(t, k); },
        get: (t, k) => { const v = Reflect.get(t, k); return typeof v === 'function' && k !== K ? v.bind(t) : v; } });
      const d = Object.getOwnPropertyDescriptor(globalThis, 'window')!; Object.defineProperty(globalThis, 'window', { configurable: true, enumerable: d.enumerable, writable: true, value: prox });
      let s1: any, s2: any;
      try { s1 = r1MonitorRead(); s2 = r1MonitorRead(); } finally { Object.defineProperty(globalThis, 'window', d); }
      expect(s1.slot, mode).toBe('F'); expect(r1MonitorFields(ins, s1).ctx, mode).toBe('OBSERVER_ERROR');
      expect({ ...s1, slot: 'Y' }, mode).toEqual(base);                   // frozen observations unchanged
      expect(s2, mode).toEqual(s1);                                        // repeat read: same frozen result, same outcome
      expect(r1MonitorRead(), mode).toEqual({ ...s1, slot: 'Y' });         // with deletion working again it is removed
      expect(r1MonitorRead(), mode).toBeNull();
    }
  });
  it('C13 (last: leaves a permanent slot) non-configurable owned slot after a TTL: LATE keeps precedence and slot F is recorded', async () => {
    const L = lib(); tree(el, L.reg); const ins = r1MonitorInstall(el, { ...opts, ttlMs: 20 }); kd('Space');
    Object.defineProperty(window, K, { configurable: false });
    await new Promise((r) => setTimeout(r, 50));
    const s = r1MonitorRead(); expect(s.slot).toBe('F'); expect(r1MonitorFields(ins, s).ctx).toBe('LATE');
    expect({ ...s, slot: 'Y' }).toMatchObject({ late: true, drops: 0, cancels: 0 });
    expect(r1MonitorRead()).toEqual(s);                                  // idempotent: same frozen result while the slot remains
  });
});
