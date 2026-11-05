// ABOUTME: BA-R1S SYNCHRONIZED-INPUT CANDIDATE model (source/fake only): the real CurriculumView + DndContext + KeyboardSensor in jsdom
// ABOUTME: with React's real scheduler drive the committed r1-sync gate; controls: target, timeout stop, stale, wrong drag, rapid input.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MemoryRouter } from 'react-router-dom';
import { CurriculumView } from '../CurriculumView';
import { r1MonitorInstall, r1MonitorRead, r1MonitorFields } from '../../../../../../scripts/builder-authoring-fixture/r1-monitor.mjs';
import { r1SyncPre, r1SyncState, r1SyncDrop } from '../../../../../../scripts/builder-authoring-fixture/r1-sync.mjs';

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

/** The model's bounded condition wait: up to `max` scheduler tasks, by condition (the spec uses expect.poll's bound). */
const taskWait = (max: number) => async (probe: () => Promise<string>) => {
  for (let i = 0; i < max; i++) { if ((await probe()) === 'DONE') return; await macrotask(); }
  throw new Error('bound');
};
const OVER = (x: string, y: string) => `Draggable item ${x} was moved over droppable area ${y}.`;
type Opts = { gate: boolean; staleRegion?: boolean; grab?: 0 | 1; max?: number; detachPre?: boolean; replaceAfter?: number };
async function drive(o: Opts) {
  const calls: string[][] = [];
  const r = render(<MemoryRouter><TooltipProvider><CurriculumView courseTitle="T" modules={MODULES} onAddModule={vi.fn()}
    onRenameModule={vi.fn()} onDeleteModule={vi.fn()} onReorderModules={(ids) => calls.push(ids)} onAddLesson={vi.fn()}
    onRenameLesson={vi.fn()} onDeleteLesson={vi.fn()} onTogglePublishLesson={vi.fn()} onReorderLessons={vi.fn()}
    onSelectLesson={vi.fn()} /></TooltipProvider></MemoryRouter>);
  await act(async () => { await macrotask(); });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
  const handles = r.getAllByRole('button', { name: 'Reorder section' });
  const handle = handles[0];                                 // the moving section A's handle (the spec's handle)
  const grabbed = handles[o.grab ?? 0];                      // the handle actually picked up (1 = wrong drag)
  if (o.staleRegion) document.querySelectorAll('[id^="DndLiveRegion"]')[0].textContent = OVER(A, B);
  const min = r1MonitorInstall(handle, { moving: A, target: B, ttlMs: 60000 });
  const AB = { moving: A, target: B };
  const detached = handle.cloneNode(true) as HTMLElement;     // a node that is not in the document (unmounted/replaced)
  const pre = r1SyncPre(o.detachPre ? detached : handle, AB);
  let word: string | null = null, err: string | null = null, drops = 0, spaces = 0;
  if (!o.gate || pre === 'CLEAN') {
    grabbed.focus();
    key(grabbed, 'Space'); spaces++; await microtasks(); await macrotask();   // the spec's pickup barrier
    key(grabbed, 'ArrowDown'); await microtasks();
    if (o.gate) {
      try {
        let reads = 0;
        const read = async () => { reads++; if (o.replaceAfter !== undefined && reads > o.replaceAfter) detached.setAttribute('aria-pressed', 'true');
          return r1SyncState(o.replaceAfter !== undefined && reads > o.replaceAfter ? detached : handle, AB); };
        word = await r1SyncDrop({ read, wait: taskWait(o.max ?? 20),
          drop: async () => { drops++; key(grabbed, 'Space'); spaces++; } });
      } catch (e) { err = (e as Error).message; }
    } else { key(grabbed, 'Space'); spaces++; }               // rapid input: BA-R1's sequence, unchanged
    await microtasks(); for (let i = 0; i < 5; i++) await macrotask();
  }
  const after = r1SyncState(handle, AB);
  const pressedAfter = handle.getAttribute('aria-pressed');
  const monitor = r1MonitorFields(min, structuredClone(r1MonitorRead()));
  cleanup();
  return { pre, word, err, drops, spaces, calls, after, pressedAfter, monitor };
}
const log = (n: string, r: any) => console.log(`R1S ${n} ${JSON.stringify(r)}`);

describe('BA-R1S SYNCHRONIZED-INPUT CANDIDATE gate (real component; separate from the rapid-input BA-R1 RED)', () => {
  it('target positive: the gate waits for the current drag OVER_TARGET, then the one final Space reorders once [B,A,C]', async () => {
    const r = await drive({ gate: true }); log('P', r);
    expect(r.pre).toBe('CLEAN'); expect(r.word).toBe('OVER_TARGET'); expect(r.err).toBeNull();
    expect(r.drops).toBe(1); expect(r.spaces).toBe(2); expect(r.calls).toEqual([[B, A, C]]);
    expect(r.monitor.end_over).toBe('TARGET'); expect(r.after).toBe('NOT_ACTIVE');   // after the drop the old text is stale
  });
  it('candidate timeout control: tall source never announces the target; the gate STOPS before the final Space, no reorder', async () => {
    heights = [900, 120, 120];
    const r = await drive({ gate: true }); log('TIMEOUT', r);
    expect(r.err).toMatch(/^BA_R1S_E_TIMEOUT_(OVER_SELF|PICKED|NOT_ANNOUNCED)$/); expect(r.word).toBeNull();
    expect(r.drops).toBe(0); expect(r.spaces).toBe(1); expect(r.calls).toEqual([]);
    expect(r.pressedAfter).toBe('true');                    // the drag was left in flight: no drop key was sent
    expect(r.monitor.end).toBe('NONE');
  });
  it('stale negative: an exact target announcement already present before pickup refuses before any key', async () => {
    const r = await drive({ gate: true, staleRegion: true }); log('STALE', r);
    expect(r.pre).toBe('STALE'); expect(r.spaces).toBe(0); expect(r.calls).toEqual([]);
  });
  it('wrong-drag negative: another section picked up; the gate stops with WRONG_DRAG and never drops', async () => {
    const r = await drive({ gate: true, grab: 1 }); log('WRONG', r);
    expect(r.err).toBe('BA_R1S_E_WRONG_DRAG'); expect(r.drops).toBe(0); expect(r.spaces).toBe(1); expect(r.calls).toEqual([]);
  });
  it('detached handle at precheck: READ_ERROR, refused before any key', async () => {
    const r = await drive({ gate: true, detachPre: true }); log('DETACHED_PRE', r);
    expect(r.pre).toBe('READ_ERROR'); expect(r.spaces).toBe(0); expect(r.calls).toEqual([]);
  });
  it('handle replaced late in the wait (detached, still aria-pressed): READ_ERROR, no final Space, no reorder', async () => {
    heights = [900, 120, 120];                                // the wait is still open when the handle is replaced
    const r = await drive({ gate: true, replaceAfter: 2 }); log('REPLACED_LATE', r);
    expect(r.err).toBe('BA_R1S_E_READ_ERROR'); expect(r.drops).toBe(0); expect(r.spaces).toBe(1); expect(r.calls).toEqual([]);
    expect(r.pressedAfter).toBe('true');
  });
  it('detached handle with zero pressed elements and the exact old target text is never OVER_TARGET (reviewed hole)', async () => {
    const r = await drive({ gate: true }); log('P2', r);           // a completed drop: nothing is pressed afterwards
    expect(r.calls).toEqual([[B, A, C]]);
    const ghost = document.createElement('button'); ghost.setAttribute('aria-pressed', 'true');   // detached, kept its pressed state
    const region = document.createElement('div'); region.id = 'DndLiveRegion-ghost'; region.textContent = OVER(A, B);
    document.body.appendChild(region);
    try {
      expect(document.querySelectorAll('[aria-pressed="true"]').length).toBe(0);
      expect(r1SyncState(ghost, { moving: A, target: B })).toBe('READ_ERROR');
      let drops = 0; let err = '';
      try { await r1SyncDrop({ read: async () => r1SyncState(ghost, { moving: A, target: B }), wait: taskWait(5), drop: async () => { drops++; } }); }
      catch (e) { err = (e as Error).message; }
      expect(err).toBe('BA_R1S_E_READ_ERROR'); expect(drops).toBe(0);
    } finally { region.remove(); }
  });
  it('rapid-input BA-R1 sequence is NOT repaired by the candidate: without the gate it still ends on itself with no reorder', async () => {
    const r = await drive({ gate: false }); log('RAPID', r);
    expect(r.monitor.over_requested).toBe('TARGET'); expect(r.monitor.end_over).toBe('SELF'); expect(r.calls).toEqual([]);
  });
});
