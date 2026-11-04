// ABOUTME: Unit tests for LessonSaveQueue: confirmed acknowledgement, retry, ordering,
// ABOUTME: per-lesson isolation, conflicts, readback mismatch and session recovery.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LessonSaveQueue,
  getSharedLessonSaveQueue,
  isDefinitive,
  resolveSessionStorage,
  suspendForeignLessonSaveQueues,
  __resetSharedLessonSaveQueues,
  type DraftStorage,
  type PersistedLesson,
} from '../lessonSaveQueue';

function memoryStorage(): DraftStorage & { dump(): Record<string, string>; length: number; key(i: number): string | null } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    get length() {
      return m.size;
    },
    key: (i) => Array.from(m.keys())[i] ?? null,
    dump: () => Object.fromEntries(m),
  };
}

const definitive = (message: string) => Object.assign(new Error(message), { code: '42501' });
const mirrored = (storage: ReturnType<typeof memoryStorage>, key: string) => {
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

const row = (id: string, title: string, content: string, updated_at: string): PersistedLesson => ({
  id,
  title,
  content,
  updated_at,
});

/** Default authoritative read: fails loudly if a test reaches reconciliation without wiring one. */
const noRead = vi.fn(async (): Promise<PersistedLesson | null> => {
  throw new Error('read not wired in this test');
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LessonSaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces, then acknowledges only the row the server returned', async () => {
    const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
    const q = new LessonSaveQueue({ read: noRead, persist, debounceMs: 800 });
    q.track(row('A', 'Old', 'Body', 't1'));

    q.edit('A', { title: 'New', content: 'Body' });
    expect(q.get('A')!.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(799);
    expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledWith('A', { title: 'New', content: 'Body' }, 't1');
    await vi.runAllTimersAsync();
    expect(q.get('A')!.status).toBe('saved');
    expect(q.hasUnsaved()).toBe(false);
  });

  it('flush skips the debounce (navigation inside 800 ms)', async () => {
    const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
    const q = new LessonSaveQueue({ read: noRead, persist, debounceMs: 800 });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Fast', content: '' });
    await expect(q.flush('A')).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('a rejected write keeps the dirty draft, reports it, and retry sends the latest draft', async () => {
    let fail = true;
    const persist = vi.fn(async (id: string, f: any) => {
      if (fail) throw Object.assign(new Error('permission denied'), { code: '42501' }); // definitive
      return row(id, f.title, f.content, 't2');
    });
    const onFailed = vi.fn();
    const q = new LessonSaveQueue({ read: noRead, persist, onFailed });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Mine', content: '' });
    await expect(q.flush('A')).resolves.toBe(false);
    expect(q.get('A')!.status).toBe('error');
    expect(q.get('A')!.error).toBe('permission denied');
    expect(q.get('A')!.draft.title).toBe('Mine');
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(q.hasUnsaved()).toBe(true);

    q.edit('A', { title: 'Mine 2', content: '' });
    await vi.advanceTimersByTimeAsync(0);
    fail = false;
    await expect(q.retry('A')).resolves.toBe(true);
    expect(persist).toHaveBeenLastCalledWith('A', { title: 'Mine 2', content: '' }, 't1');
    expect(q.get('A')!.status).toBe('saved');
  });

  it('describes network failures as offline, not as saved', async () => {
    const persist = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const q = new LessonSaveQueue({ read: noRead, persist });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'x', content: '' });
    await q.flush('A');
    expect(q.get('A')!.status).toBe('error');
    expect(q.get('A')!.error).toMatch(/offline/i);
  });

  it('treats a readback that differs from what was sent as not saved', async () => {
    const persist = vi.fn(async (id: string) => row(id, 'Something else', '', 't2'));
    const q = new LessonSaveQueue({ read: noRead, persist });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Sent', content: '' });
    await expect(q.flush('A')).resolves.toBe(false);
    expect(q.get('A')!.status).toBe('error');
    expect(q.get('A')!.draft.title).toBe('Sent');
  });

  it('keeps one write in flight per lesson and sends newer edits after it, in order', async () => {
    const calls: Array<{ f: any; d: ReturnType<typeof deferred<PersistedLesson>> }> = [];
    const persist = vi.fn((id: string, f: any) => {
      const d = deferred<PersistedLesson>();
      calls.push({ f, d });
      return d.promise;
    });
    const q = new LessonSaveQueue({ read: noRead, persist, debounceMs: 10 });
    q.track(row('A', 'v0', '', 't0'));

    q.edit('A', { title: 'v1', content: '' });
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(1);
    q.edit('A', { title: 'v2', content: '' });
    await vi.advanceTimersByTimeAsync(50);
    // Second edit must wait: still exactly one write.
    expect(calls).toHaveLength(1);

    calls[0].d.resolve(row('A', 'v1', '', 't1'));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(calls[1].f.title).toBe('v2');
    expect(persist).toHaveBeenLastCalledWith('A', { title: 'v2', content: '' }, 't1');
    expect(q.get('A')!.status).toBe('saving');

    calls[1].d.resolve(row('A', 'v2', '', 't2'));
    await vi.runAllTimersAsync();
    expect(q.get('A')!.status).toBe('saved');
    expect(q.get('A')!.draft.title).toBe('v2');
  });

  it('never applies a response for one lesson to another', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<PersistedLesson>>>();
    const persist = vi.fn((id: string) => {
      const d = deferred<PersistedLesson>();
      pending.set(id, d);
      return d.promise;
    });
    const onPersisted = vi.fn();
    const q = new LessonSaveQueue({ read: noRead, persist, onPersisted });
    q.track(row('A', 'A0', '', 'a0'));
    q.track(row('B', 'B0', '', 'b0'));
    q.edit('A', { title: 'A1', content: '' });
    void q.flush('A');
    q.edit('B', { title: 'B1', content: '' });
    await vi.advanceTimersByTimeAsync(0); // the write starts on A's chain

    pending.get('A')!.resolve(row('A', 'A1', '', 'a1'));
    await vi.advanceTimersByTimeAsync(0);
    expect(q.get('A')!.status).toBe('saved');
    expect(q.get('B')!.status).toBe('dirty');
    expect(q.get('B')!.draft.title).toBe('B1');
    expect(onPersisted).toHaveBeenCalledWith(expect.objectContaining({ id: 'A', title: 'A1' }));
    expect(onPersisted).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }));
  });

  it('rejects a response row with a different id', async () => {
    const persist = vi.fn(async () => row('OTHER', 'x', '', 't2'));
    const q = new LessonSaveQueue({ read: noRead, persist });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'x', content: '' });
    await expect(q.flush('A')).resolves.toBe(false);
    expect(q.get('A')!.status).toBe('error');
  });

  it('reports a conflict instead of overwriting, and lets the author choose', async () => {
    const theirs = row('A', 'Theirs', 'their body', 't9');
    let conflict = true;
    const persist = vi.fn(async (id: string, f: any, expected: string | null) => {
      if (conflict) {
        const err: any = new Error('changed');
        err.name = 'LessonSaveConflictError';
        err.current = theirs;
        throw err;
      }
      return row(id, f.title, f.content, 't10');
    });
    const q = new LessonSaveQueue({ read: noRead, persist });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Mine', content: '' });
    await q.flush('A');
    expect(q.get('A')!.status).toBe('conflict');
    expect(q.get('A')!.conflictWith).toEqual(theirs);
    // No silent retries while in conflict.
    q.edit('A', { title: 'Mine more', content: '' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(persist).toHaveBeenCalledTimes(1);

    conflict = false;
    await expect(q.resolveConflict('A', 'keepMine')).resolves.toBe(true);
    expect(persist).toHaveBeenLastCalledWith('A', { title: 'Mine more', content: '' }, 't9');
    expect(q.get('A')!.status).toBe('saved');
  });

  describe('version-only changes (curriculum reorder bumps updated_at)', () => {
    const conflictWith = (current: PersistedLesson) =>
      Object.assign(new Error('changed'), { name: 'LessonSaveConflictError', current });

    it('a save after a reorder adopts the new version and saves, with no conflict shown', async () => {
      let serverVersion = 't1';
      const persist = vi.fn(async (id: string, f: any, expected: string | null) => {
        if (expected !== serverVersion) throw conflictWith(row(id, 'Old', 'Body', serverVersion));
        serverVersion = 't3';
        return row(id, f.title, f.content, 't3');
      });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'Body', 't1'));
      serverVersion = 't2'; // reorder_content_items touched the row: same title and body, new version
      q.edit('A', { title: 'New', content: 'Body' });
      await expect(q.flush('A')).resolves.toBe(true);
      expect(persist).toHaveBeenNthCalledWith(1, 'A', { title: 'New', content: 'Body' }, 't1');
      expect(persist).toHaveBeenNthCalledWith(2, 'A', { title: 'New', content: 'Body' }, 't2');
      expect(q.get('A')!.status).toBe('saved');
      expect(q.get('A')!.conflictWith).toBeNull();
    });

    it('still reports a conflict when the title or body changed elsewhere', async () => {
      const persist = vi.fn(async (id: string) => {
        throw conflictWith(row(id, 'Old', 'Edited in another tab', 't2'));
      });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'Body', 't1'));
      q.edit('A', { title: 'New', content: 'Body' });
      await q.flush('A');
      expect(persist).toHaveBeenCalledTimes(1);
      expect(q.get('A')!.status).toBe('conflict');
    });

    it('gives up after a bounded number of version-only retries', async () => {
      let n = 1;
      const persist = vi.fn(async (id: string) => {
        n += 1;
        throw conflictWith(row(id, 'Old', 'Body', `t${n}`));
      });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'Body', 't1'));
      q.edit('A', { title: 'New', content: 'Body' });
      await q.flush('A');
      expect(persist).toHaveBeenCalledTimes(3);
      expect(q.get('A')!.status).toBe('conflict');
    });

    it('a publish after a reorder retries once on the new version', async () => {
      const persist = vi.fn();
      const side = vi
        .fn()
        .mockRejectedValueOnce(conflictWith(row('A', 'Old', 'Body', 't2')))
        .mockResolvedValueOnce({ ...row('A', 'Old', 'Body', 't3'), published: true });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'Body', 't1'));
      await expect(q.sideWrite('A', side)).resolves.toMatchObject({ ok: true });
      expect(side).toHaveBeenNthCalledWith(1, 't1');
      expect(side).toHaveBeenNthCalledWith(2, 't2');
      expect(persist).not.toHaveBeenCalled();
      expect(q.get('A')!.status).toBe('saved');
    });
  });

  it('useTheirs discards the draft and adopts the server row', async () => {
    const theirs = row('A', 'Theirs', 'tb', 't9');
    const persist = vi.fn(async () => {
      const err: any = new Error('changed');
      err.name = 'LessonSaveConflictError';
      err.current = theirs;
      throw err;
    });
    const q = new LessonSaveQueue({ read: noRead, persist });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Mine', content: '' });
    await q.flush('A');
    const rev = q.get('A')!.revision;
    await q.resolveConflict('A', 'useTheirs');
    expect(q.get('A')!.status).toBe('saved');
    expect(q.get('A')!.draft).toEqual({ title: 'Theirs', content: 'tb' });
    expect(q.get('A')!.revision).toBe(rev + 1);
  });

  it('mirrors unconfirmed drafts to storage and restores them in a new page session', async () => {
    const storage = memoryStorage();
    const failing = new LessonSaveQueue({
      read: noRead,
      persist: async () => {
        throw new Error('offline');
      },
      storage,
      storageScope: 'c1',
    });
    failing.track(row('A', 'Old', '', 't1'));
    failing.edit('A', { title: 'Unsaved', content: 'b' });
    await failing.flush('A');
    expect(Object.keys(storage.dump())).toEqual(['ic.builder.lessonDraft.v2.c1.A']);

    const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
    // The failed send's outcome is unknown, so the fresh queue reads first (and fences on t1).
    const read = vi.fn(async () => row('A', 'Old', '', 't1'));
    const next = new LessonSaveQueue({ read, persist, storage, storageScope: 'c1', debounceMs: 5 });
    const snap = next.track(row('A', 'Old', '', 't1'));
    expect(snap.recovered).toBe(true);
    expect(snap.draft).toEqual({ title: 'Unsaved', content: 'b' });
    await vi.runAllTimersAsync();
    expect(persist).toHaveBeenCalledWith('A', { title: 'Unsaved', content: 'b' }, 't1');
    expect(next.get('A')!.status).toBe('saved');
    expect(storage.dump()).toEqual({});
  });

  it('a restored draft whose base changed on the server becomes a conflict, not a write', async () => {
    const storage = memoryStorage();
    storage.setItem(
      'ic.builder.lessonDraft.v2.c1.A',
      JSON.stringify({ v: 2, owner: 'earlier-page', draft: { title: 'Stale mine', content: '' }, base: { known: true, value: 't1' } }),
    );
    const persist = vi.fn();
    const q = new LessonSaveQueue({ read: noRead, persist: persist as any, storage, storageScope: 'c1' });
    const snap = q.track(row('A', 'Newer', '', 't5'));
    expect(snap.status).toBe('conflict');
    expect(snap.draft.title).toBe('Stale mine');
    await vi.runAllTimersAsync();
    expect(persist).not.toHaveBeenCalled();
  });

  it('track never overwrites a dirty draft with a reloaded server row', () => {
    const q = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'Typing', content: '' });
    q.track(row('A', 'Server', '', 't2'));
    expect(q.get('A')!.draft.title).toBe('Typing');
  });

  it('ignores a late response for a lesson that was deleted', async () => {
    const d = deferred<PersistedLesson>();
    const onPersisted = vi.fn();
    const q = new LessonSaveQueue({ read: noRead, persist: () => d.promise, onPersisted });
    q.track(row('A', 'Old', '', 't1'));
    q.edit('A', { title: 'x', content: '' });
    const flushed = q.flush('A');
    q.forget('A');
    d.resolve(row('A', 'x', '', 't2'));
    await flushed;
    expect(onPersisted).not.toHaveBeenCalled();
    expect(q.get('A')).toBeNull();
  });

  // ---------------- correction batch ----------------

  describe('R1: side actions share the lesson chain and are gated', () => {
    it('rename and sideWrite are refused with no write while the lesson is failed, conflicted or uncertain', async () => {
      const cases: Array<[string, () => Promise<PersistedLesson>]> = [
        ['error', async () => Promise.reject(definitive('denied'))],
        ['uncertain', async () => Promise.reject(new TypeError('Failed to fetch'))],
        [
          'conflict',
          async () =>
            Promise.reject(Object.assign(new Error('x'), { name: 'LessonSaveConflictError', current: row('A', 'Theirs', '', 't9') })),
        ],
      ];
      for (const [label, fail] of cases) {
        const persist = vi.fn(fail);
        const side = vi.fn(async () => row('A', 'Old', '', 't3'));
        const q = new LessonSaveQueue({ read: noRead, persist });
        q.track(row('A', 'Old', '', 't1'));
        q.edit('A', { title: 'Mine', content: '' });
        await q.flush('A');
        expect(q.blockedReason('A'), label).not.toBeNull();
        persist.mockClear();
        await expect(q.rename('A', 'Renamed')).resolves.toMatchObject({ ok: false });
        await expect(q.sideWrite('A', side)).resolves.toMatchObject({ ok: false });
        expect(persist, label).not.toHaveBeenCalled();
        expect(side, label).not.toHaveBeenCalled();
        expect(q.get('A')!.draft.title, label).toBe('Mine');
      }
    });

    it('a rename issued while an earlier save is in flight does not re-send it if that save fails', async () => {
      const first = deferred<PersistedLesson>();
      const persist = vi.fn().mockReturnValueOnce(first.promise);
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'b', 't1'));
      q.edit('A', { title: 'Old', content: 'b2' });
      const f = q.flush('A');
      await vi.advanceTimersByTimeAsync(0);
      const r = q.rename('A', 'Renamed');
      first.reject(definitive('denied'));
      await f;
      await expect(r).resolves.toMatchObject({ ok: false });
      expect(persist).toHaveBeenCalledTimes(1);
      expect(q.get('A')!.draft).toEqual({ title: 'Renamed', content: 'b2' }); // kept, not lost or re-sent
      expect(q.get('A')!.status).toBe('error');
    });

    it('repeated renames are serialized: one write in flight, the last rename wins, edits issued later win', async () => {
      const calls: Array<{ f: any; d: ReturnType<typeof deferred<PersistedLesson>> }> = [];
      let n = 1;
      const persist = vi.fn((id: string, f: any) => {
        const d = deferred<PersistedLesson>();
        calls.push({ f, d });
        return d.promise;
      });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', 'b', 't1'));
      const r1 = q.rename('A', 'R1');
      const r2 = q.rename('A', 'R2');
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toHaveLength(1);
      q.edit('A', { title: 'R2', content: 'typed later' });
      calls[0].d.resolve(row('A', calls[0].f.title, calls[0].f.content, `t${++n}`));
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toHaveLength(2);
      expect(calls[1].f).toEqual({ title: 'R2', content: 'typed later' });
      calls[1].d.resolve(row('A', 'R2', 'typed later', `t${++n}`));
      await expect(r1).resolves.toMatchObject({ ok: true });
      await expect(r2).resolves.toMatchObject({ ok: true });
      await vi.runAllTimersAsync();
      expect(persist).toHaveBeenCalledTimes(2);
      expect(q.get('A')!.status).toBe('saved');
    });

    it('sideWrite runs after the pending draft save, conditional on the confirmed version', async () => {
      const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
      const side = vi.fn(async (expected: string | null) => ({ ...row('A', 'Mine', '', 't3'), published: false, expected }));
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track(row('A', 'Old', '', 't1'));
      q.edit('A', { title: 'Mine', content: '' });
      const out = await q.sideWrite('A', side);
      expect(persist).toHaveBeenCalledWith('A', { title: 'Mine', content: '' }, 't1');
      expect(side).toHaveBeenCalledWith('t2');
      expect(out).toMatchObject({ ok: true, row: { published: false } });
      // The next draft save is conditional on the side write's version.
      q.edit('A', { title: 'Mine 2', content: '' });
      await q.flush('A');
      expect(persist).toHaveBeenLastCalledWith('A', { title: 'Mine 2', content: '' }, 't3');
    });
  });

  describe('R2: mirror ownership across instances', () => {
    function setup() {
      const storage = memoryStorage();
      const key = 'ic.builder.lessonDraft.v2.u1:c1.A';
      const d1 = deferred<PersistedLesson>();
      const q1 = new LessonSaveQueue({ read: noRead, persist: () => d1.promise, storage, storageScope: 'u1:c1' });
      q1.track(row('A', 'Old', '', 't1'));
      q1.edit('A', { title: 'v1', content: '' });
      const f1 = q1.flush('A');
      // A second instance (e.g. a remount that missed the shared registry) restores and edits.
      const persist2 = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't9'));
      const q2 = new LessonSaveQueue({ read: noRead, persist: persist2, storage, storageScope: 'u1:c1', debounceMs: 10_000 });
      q2.track(row('A', 'Old', '', 't1'));
      expect(q2.get('A')!.draft.title).toBe('v1');
      q2.edit('A', { title: 'v2', content: '' });
      return { storage, key, d1, f1, q1, q2 };
    }

    it('old instance success after the new instance edited: the newer mirror is not removed', async () => {
      const { storage, key, d1, f1 } = setup();
      d1.resolve(row('A', 'v1', '', 't2'));
      await f1;
      await vi.advanceTimersByTimeAsync(0);
      expect(mirrored(storage, key)?.draft.title).toBe('v2');
    });

    it('old instance failure after the new instance edited: the newer mirror is not overwritten', async () => {
      const { storage, key, d1, f1 } = setup();
      d1.reject(definitive('denied'));
      await f1;
      await vi.advanceTimersByTimeAsync(0);
      expect(mirrored(storage, key)?.draft.title).toBe('v2');
      const next = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u1:c1' });
      expect(next.track(row('A', 'Old', '', 't1')).draft.title).toBe('v2');
    });

    it('forget by a non-owner leaves the owner\'s mirror alone', async () => {
      const { storage, key, q1 } = setup();
      q1.forget('A'); // the old instance (no longer the owner) drops the lesson
      await vi.advanceTimersByTimeAsync(0);
      expect(mirrored(storage, key)?.draft.title).toBe('v2');
    });

    it('the shared registry returns one queue per key for the tab lifetime', () => {
      __resetSharedLessonSaveQueues();
      const make = vi.fn(() => new LessonSaveQueue({ read: noRead, persist: vi.fn() as any }));
      const a = getSharedLessonSaveQueue('u1:c1', make);
      expect(getSharedLessonSaveQueue('u1:c1', make)).toBe(a);
      expect(getSharedLessonSaveQueue('u2:c1', make)).not.toBe(a);
      expect(make).toHaveBeenCalledTimes(2);
      __resetSharedLessonSaveQueues();
    });
  });

  describe('R3: uncertain writes', () => {
    it('applied-but-lost, then Undo to the last confirmed value: never marked saved before an authoritative read', async () => {
      const server = { title: 'A', content: '', updated_at: 't1' };
      const persist = vi.fn(async (id: string, f: any, expected: string | null) => {
        if (expected !== server.updated_at) throw Object.assign(new Error('c'), { name: 'LessonSaveConflictError', current: { id, ...server } });
        Object.assign(server, f, { updated_at: `t${persist.mock.calls.length + 1}` });
        if (persist.mock.calls.length === 1) throw new TypeError('Failed to fetch'); // applied, response lost
        return { id, ...server };
      });
      const read = vi.fn(async (id: string) => ({ id, ...server }));
      const storage = memoryStorage();
      const q = new LessonSaveQueue({ read, persist, storage, storageScope: 'u1:c1' });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      expect(q.get('A')).toMatchObject({ status: 'error', uncertain: true });

      q.edit('A', { title: 'A', content: '' }); // Undo
      expect(q.get('A')!.status).not.toBe('saved');
      expect(q.hasUnsaved()).toBe(true);
      expect(mirrored(storage, 'ic.builder.lessonDraft.v2.u1:c1.A')?.draft.title).toBe('A');
      expect(q.blockedReason('A')).not.toBeNull();

      await vi.runAllTimersAsync();
      expect(read).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenCalledTimes(2);
      expect(persist.mock.calls[1]).toEqual(['A', { title: 'A', content: '' }, 't2']);
      expect(server.title).toBe('A');
      expect(q.get('A')).toMatchObject({ status: 'saved', uncertain: false });
    });

    it('a failed authoritative read keeps the lesson uncertain and writes nothing', async () => {
      const persist = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const read = vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      });
      const q = new LessonSaveQueue({ read, persist });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      await expect(q.retry('A')).resolves.toBe(false);
      expect(persist).toHaveBeenCalledTimes(1);
      expect(q.get('A')).toMatchObject({ status: 'error', uncertain: true });
      q.discard('A');
      expect(q.get('A')!.draft.title).toBe('B'); // discard is refused while uncertain
    });

    it('if the stored row is neither what we confirmed nor what we sent, it is a conflict (no compensation)', async () => {
      const persist = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const read = vi.fn(async () => row('A', 'Someone else', '', 't7'));
      const q = new LessonSaveQueue({ read, persist });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      await expect(q.retry('A')).resolves.toBe(false);
      expect(q.get('A')!.status).toBe('conflict');
      expect(persist).toHaveBeenCalledTimes(1);
    });
  });

  describe('R4: NULL baseline vs unavailable version', () => {
    it('a known NULL updated_at is sent as null (null-safe condition), not skipped', async () => {
      const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track({ id: 'A', title: 'Old', content: '', updated_at: null });
      q.edit('A', { title: 'New', content: '' });
      await expect(q.flush('A')).resolves.toBe(true);
      expect(persist).toHaveBeenCalledWith('A', { title: 'New', content: '' }, null);
    });

    it('a NULL baseline with an intervening update surfaces the conflict', async () => {
      const persist = vi.fn(async () => {
        throw Object.assign(new Error('c'), { name: 'LessonSaveConflictError', current: row('A', 'Other', '', 't5') });
      });
      const q = new LessonSaveQueue({ read: noRead, persist });
      q.track({ id: 'A', title: 'Old', content: '', updated_at: null });
      q.edit('A', { title: 'Mine', content: '' });
      await q.flush('A');
      expect(q.get('A')).toMatchObject({ status: 'conflict', conflictWith: { title: 'Other' } });
    });

    it('an unavailable version is never written unconditionally: it reconciles first, and refuses if still unknown', async () => {
      const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
      const read = vi.fn(async () => ({ id: 'A', title: 'Old', content: '' }) as PersistedLesson);
      const q = new LessonSaveQueue({ read, persist });
      q.track({ id: 'A', title: 'Old', content: '' }); // no updated_at at all
      q.edit('A', { title: 'New', content: '' });
      expect(q.get('A')!.status).toBe('dirty');
      await expect(q.flush('A')).resolves.toBe(false);
      expect(persist).not.toHaveBeenCalled();
      expect(q.get('A')!.error).toMatch(/refused rather than written unconditionally/);

      read.mockResolvedValueOnce(row('A', 'Old', '', 't1'));
      await expect(q.retry('A')).resolves.toBe(true);
      expect(persist).toHaveBeenCalledWith('A', { title: 'New', content: '' }, 't1');
    });

    it('a mirrored draft taken on a NULL base restores only while the row is still NULL', () => {
      const storage = memoryStorage();
      const key = 'ic.builder.lessonDraft.v2.u1:c1.A';
      const value = JSON.stringify({ v: 2, owner: 'x', draft: { title: 'Mine', content: '' }, base: { known: true, value: null } });
      storage.setItem(key, value);
      const same = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u1:c1' });
      expect(same.track({ id: 'A', title: 'Old', content: '', updated_at: null }).status).toBe('dirty');
      same.cancelTimers();

      storage.setItem(key, value);
      const moved = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u1:c1' });
      expect(moved.track({ id: 'A', title: 'Other', content: '', updated_at: 't5' }).status).toBe('conflict');
    });
  });

  describe('recovery boundary', () => {
    it('resolveSessionStorage returns null when the getter throws', () => {
      const own = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
      try {
        expect(resolveSessionStorage()).toBeNull();
      } finally {
        if (own) Object.defineProperty(window, 'sessionStorage', own);
      }
    });

    it('no storage, or a failing mirror write, is reported as not recoverable', async () => {
      const persist = vi.fn().mockRejectedValue(definitive('denied'));
      const none = new LessonSaveQueue({ read: noRead, persist, storage: null, storageScope: 'u1:c1' });
      none.track(row('A', 'Old', '', 't1'));
      none.edit('A', { title: 'x', content: '' });
      await none.flush('A');
      expect(none.get('A')!.recoverable).toBe(false);

      const full = memoryStorage();
      full.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
      const q = new LessonSaveQueue({ read: noRead, persist, storage: full, storageScope: 'u1:c1' });
      q.track(row('A', 'Old', '', 't1'));
      expect(q.get('A')!.recoverable).toBe(true);
      q.edit('A', { title: 'x', content: '' });
      await q.flush('A');
      expect(q.get('A')!.recoverable).toBe(false);
    });

    it('drafts are scoped by user: another user\'s mirror is never restored', () => {
      const storage = memoryStorage();
      storage.setItem(
        'ic.builder.lessonDraft.v2.u1:c1.A',
        JSON.stringify({ v: 2, owner: 'x', draft: { title: 'U1 draft', content: '' }, base: { known: true, value: 't1' } }),
      );
      const u2 = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u2:c1' });
      expect(u2.track(row('A', 'Old', '', 't1'))).toMatchObject({ status: 'saved', recovered: false });
    });

    it('other users\' and legacy mirrors are never restored and never deleted', () => {
      const storage = memoryStorage();
      storage.setItem(
        'ic.builder.lessonDraft.v2.u1:c1.A',
        JSON.stringify({ v: 2, owner: 'x', draft: { title: 'U1', content: '' }, base: { known: true, value: 't1' } }),
      );
      storage.setItem('ic.builder.lessonDraft.c1.A', JSON.stringify({ draft: { title: 'legacy', content: '' }, baseUpdatedAt: 't1' }));
      const u2 = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u2:c1' });
      expect(u2.track(row('A', 'Old', '', 't1'))).toMatchObject({ status: 'saved', recovered: false });
      u2.forget('A');
      expect(Object.keys(storage.dump()).sort()).toEqual(['ic.builder.lessonDraft.c1.A', 'ic.builder.lessonDraft.v2.u1:c1.A']);
    });

    it('suspendForeignLessonSaveQueues stops another user\'s queue without deleting its draft; resume continues', async () => {
      __resetSharedLessonSaveQueues();
      const storage = memoryStorage();
      const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
      const u1 = getSharedLessonSaveQueue('u1:c1', () => new LessonSaveQueue({ read: noRead, persist, storage, storageScope: 'u1:c1' }));
      u1.track(row('A', 'Old', '', 't1'));
      u1.edit('A', { title: 'pending', content: '' }); // debounce armed
      suspendForeignLessonSaveQueues('u2');
      await vi.runAllTimersAsync();
      expect(persist).not.toHaveBeenCalled();
      expect(u1.get('A')!.draft.title).toBe('pending');
      expect(mirrored(storage, 'ic.builder.lessonDraft.v2.u1:c1.A')?.draft.title).toBe('pending');
      expect(getSharedLessonSaveQueue('u1:c1', () => null as any)).toBe(u1);
      u1.resume();
      await vi.runAllTimersAsync();
      expect(persist).toHaveBeenCalledWith('A', { title: 'pending', content: '' }, 't1');
      expect(u1.get('A')!.status).toBe('saved');
      __resetSharedLessonSaveQueues();
    });
  });

  describe('second batch: fence, definitive errors, owner execution', () => {
    it('a read of the unchanged base after an uncertain send is not settlement: a fence is written on that version', async () => {
      // Server model with a conditional commit evaluated at commit time.
      const server = { title: 'A', content: '', updated_at: 't1' as string };
      let n = 1;
      const commit = (f: any, expected: string | null) => {
        if (server.updated_at !== expected) return false;
        Object.assign(server, f, { updated_at: `t${++n}` });
        return true;
      };
      let late: (() => boolean) | null = null;
      const persist = vi.fn(async (id: string, f: any, expected: string | null) => {
        if (!late && f.title === 'B') {
          late = () => commit(f, expected); // the request is still on its way to the database
          throw new TypeError('Failed to fetch');
        }
        if (!commit(f, expected)) throw Object.assign(new Error('c'), { name: 'LessonSaveConflictError', current: { id, ...server } });
        return { id, ...server };
      });
      const read = vi.fn(async (id: string) => ({ id, ...server }));
      const q = new LessonSaveQueue({ read, persist });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      expect(q.get('A')).toMatchObject({ status: 'error', uncertain: true });

      q.edit('A', { title: 'A', content: '' }); // Undo while B is still pending
      expect(q.get('A')!.status).not.toBe('saved');
      await vi.runAllTimersAsync();
      expect(read).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenLastCalledWith('A', { title: 'A', content: '' }, 't1'); // the fence
      expect(q.get('A')).toMatchObject({ status: 'saved', uncertain: false });
      expect(late!()).toBe(false); // the late B fails its condition
      expect(server.title).toBe('A');
    });

    it('if the late send commits before the fence, the fence is refused as a conflict, nothing is assumed, and Keep mine then writes A', async () => {
      const server = { title: 'A', content: '', updated_at: 't1' as string };
      let n = 1;
      const commit = (f: any, expected: string | null) => {
        if (server.updated_at !== expected) return false;
        Object.assign(server, f, { updated_at: `t${++n}` });
        return true;
      };
      let late: (() => boolean) | null = null;
      const persist = vi.fn(async (id: string, f: any, expected: string | null) => {
        if (!late && f.title === 'B') {
          late = () => commit(f, expected);
          throw new TypeError('Failed to fetch');
        }
        if (late && f.title === 'A' && expected === 't1') late(); // B lands just before the fence
        if (!commit(f, expected)) throw Object.assign(new Error('c'), { name: 'LessonSaveConflictError', current: { id, ...server } });
        return { id, ...server };
      });
      const read = vi.fn(async (id: string) => ({ id, ...server }));
      const q = new LessonSaveQueue({ read, persist });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      q.edit('A', { title: 'A', content: '' });
      await vi.runAllTimersAsync();
      expect(q.get('A')!.status).toBe('conflict'); // the fence was refused: the author is told, nothing is assumed
      expect(server.title).toBe('B');
      await q.resolveConflict('A', 'keepMine');
      expect(server.title).toBe('A');
      expect(q.get('A')!.status).toBe('saved');
    });

    it('useTheirs while one of our sends is still live on that version confirms with a fence before saying saved', async () => {
      const persist = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockImplementation(async (id: string, f: any) => row(id, f.title, f.content, 't9'));
      const read = vi.fn(async () => row('A', 'Theirs', '', 't1')); // same version our send used, other content
      const q = new LessonSaveQueue({ read, persist });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      await q.retry('A');
      expect(q.get('A')!.status).toBe('conflict');
      await q.resolveConflict('A', 'useTheirs');
      expect(persist).toHaveBeenLastCalledWith('A', { title: 'Theirs', content: '' }, 't1');
      expect(q.get('A')!.status).toBe('saved');
    });

    it.each([
      ['42501 RLS', '42501', true],
      ['23505 unique', '23505', true],
      ['22P02 invalid input', '22P02', true],
      ['PGRST116', 'PGRST116', true],
      ['PGRST301 jwt', 'PGRST301', true],
      ['40001 serialization', '40001', true],
      ['40003 completion unknown', '40003', false],
      ['08006 connection failure', '08006', false],
      ['57014 statement timeout', '57014', false],
      ['XX000 internal', 'XX000', false],
      ['ETIMEDOUT', 'ETIMEDOUT', false],
      ['ECONNRESET', 'ECONNRESET', false],
      ['EPIPE', 'EPIPE', false],
      ['empty', '', false],
    ])('isDefinitive: %s', (_l, code, expected) => {
      expect(isDefinitive(Object.assign(new Error('x'), { code }))).toBe(expected);
    });

    it('checks the session user before every request: a different user suspends the queue with no request and no toast', async () => {
      let who: string | null = 'u1';
      const d = deferred<PersistedLesson>();
      const persist = vi.fn().mockReturnValueOnce(d.promise);
      const onFailed = vi.fn();
      const storage = memoryStorage();
      const q = new LessonSaveQueue({
        read: noRead,
        persist,
        onFailed,
        storage,
        storageScope: 'u1:c1',
        ownerId: 'u1',
        currentUserId: async () => who,
      });
      q.track(row('A', 'Old', '', 't1'));
      q.edit('A', { title: 'v1', content: '' });
      const f = q.flush('A');
      await vi.advanceTimersByTimeAsync(0);
      expect(persist).toHaveBeenCalledTimes(1);
      q.edit('A', { title: 'v2', content: '' });
      who = 'u2';
      d.reject(definitive('denied'));
      await f;
      await vi.runAllTimersAsync();
      expect(persist).toHaveBeenCalledTimes(1);
      expect(onFailed).not.toHaveBeenCalled();
      expect(q.isSuspended()).toBe(true);
      expect(mirrored(storage, 'ic.builder.lessonDraft.v2.u1:c1.A')?.draft.title).toBe('v2');

      who = 'u1';
      q.resume();
      await expect(q.retry('A')).resolves.toBe(false); // persist mock has no more values: proves a request is made again
      expect(persist).toHaveBeenCalledTimes(2);
    });
  });

  describe('third batch: durable settlement state', () => {
    const KEY = 'ic.builder.lessonDraft.v2.u1:c1.A';

    it('records a send as outstanding in the mirror BEFORE the request resolves (write-ahead)', async () => {
      const storage = memoryStorage();
      const d = deferred<PersistedLesson>();
      const q = new LessonSaveQueue({ read: noRead, persist: () => d.promise, storage, storageScope: 'u1:c1' });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      void q.flush('A');
      await vi.advanceTimersByTimeAsync(0);
      expect(mirrored(storage, KEY)).toMatchObject({
        draft: { title: 'B' },
        confirmed: { title: 'A' },
        base: { known: true, value: 't1' },
        outstanding: [{ fields: { title: 'B', content: '' }, expected: 't1' }],
      });
      d.resolve(row('A', 'B', '', 't2'));
      await vi.runAllTimersAsync();
      expect(storage.getItem(KEY)).toBeNull(); // settled by a confirmed conditional write
    });

    it('a definitive rejection drops that send from the durable record (it cannot commit)', async () => {
      const storage = memoryStorage();
      const q = new LessonSaveQueue({ read: noRead, persist: vi.fn().mockRejectedValue(definitive('denied')), storage, storageScope: 'u1:c1' });
      q.track(row('A', 'A', '', 't1'));
      q.edit('A', { title: 'B', content: '' });
      await q.flush('A');
      expect(mirrored(storage, KEY)).toMatchObject({ draft: { title: 'B' }, outstanding: [], uncertain: false });
    });

    it('a fresh queue restores an outstanding record as uncertain even when fields equal the row, and fences before clearing it', async () => {
      const storage = memoryStorage();
      storage.setItem(
        KEY,
        JSON.stringify({
          v: 2,
          owner: 'dead-page',
          draft: { title: 'A', content: '' },
          base: { known: true, value: 't1' },
          confirmed: { title: 'A', content: '' },
          outstanding: [{ fields: { title: 'B', content: '' }, expected: 't1' }],
          uncertain: true,
        }),
      );
      const read = vi.fn(async () => row('A', 'A', '', 't1'));
      const persist = vi.fn(async (id: string, f: any) => row(id, f.title, f.content, 't2'));
      const q = new LessonSaveQueue({ read, persist, storage, storageScope: 'u1:c1' });
      const snap = q.track(row('A', 'A', '', 't1'));
      expect(snap).toMatchObject({ status: 'dirty', uncertain: true, recovered: true });
      expect(q.hasUnsaved()).toBe(true);
      expect(storage.getItem(KEY)).not.toBeNull();
      await vi.runAllTimersAsync();
      expect(read).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenCalledWith('A', { title: 'A', content: '' }, 't1'); // the fence
      expect(q.get('A')!.status).toBe('saved');
      expect(storage.getItem(KEY)).toBeNull();
    });

    it('restored reconciliation and fencing are identity-gated: another session user causes no read and no write', async () => {
      const storage = memoryStorage();
      storage.setItem(
        KEY,
        JSON.stringify({
          v: 2,
          owner: 'dead-page',
          draft: { title: 'A', content: '' },
          base: { known: true, value: 't1' },
          confirmed: { title: 'A', content: '' },
          outstanding: [{ fields: { title: 'B', content: '' }, expected: 't1' }],
          uncertain: true,
        }),
      );
      const read = vi.fn();
      const persist = vi.fn();
      const q = new LessonSaveQueue({
        read: read as any,
        persist: persist as any,
        storage,
        storageScope: 'u1:c1',
        ownerId: 'u1',
        currentUserId: async () => 'u2',
      });
      q.track(row('A', 'A', '', 't1'));
      await vi.runAllTimersAsync();
      expect(read).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
      expect(mirrored(storage, KEY)?.outstanding).toHaveLength(1);
    });

    it('an outstanding record without its confirmed base is restored as a conflict, never written blindly', () => {
      const storage = memoryStorage();
      storage.setItem(
        KEY,
        JSON.stringify({ v: 2, owner: 'x', draft: { title: 'A', content: '' }, base: { known: true, value: 't1' }, outstanding: [{ fields: { title: 'B', content: '' }, expected: 't1' }] }),
      );
      const q = new LessonSaveQueue({ read: noRead, persist: vi.fn() as any, storage, storageScope: 'u1:c1' });
      expect(q.track(row('A', 'A', '', 't1')).status).toBe('conflict');
    });
  });
});
