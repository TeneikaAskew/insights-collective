// ABOUTME: Contract tests: WatchReporter + the real videoAnalyticsService over an in-memory video_analytics fake.
// ABOUTME: Runs with the idempotent batch RPC deployed and, as the fallback, with it missing (compare-and-set).

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
type Op = { kind: 'select' | 'insert' | 'update' | 'rpc'; values?: Row };

/**
 * Minimal PostgREST-shaped fake of the one table, with the semantics that
 * matter here: UNIQUE(user_id, content_item_id), filters that must all match,
 * and hooks to pause before an operation runs or to fail after it commits.
 */
const db = vi.hoisted(() => {
  const state = {
    rows: [] as Row[],
    /** Awaited before each operation runs; lets a test interleave two writers. */
    before: null as null | ((op: Op) => Promise<void> | void),
    /** Return an error AFTER the operation committed (a lost response). */
    failAfterCommit: null as null | ((op: Op) => boolean),
    /** Whether apply_video_engagement_batch exists (migration 20261112000000 applied). */
    rpcDeployed: true,
    /** The server's batch ledger: `${user}:${batch}`. */
    batches: new Set<string>(),
    rpcCalls: 0,
  };
  return state;
});

vi.mock('@/integrations/supabase/client', () => {
  type Filter = { col: string; value: unknown; isNull: boolean };
  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) => (f.isNull ? row[f.col] === null || row[f.col] === undefined : row[f.col] === f.value));
  const pick = (row: Row, cols: string) =>
    cols === '*' ? { ...row } : Object.fromEntries(cols.split(',').map((c) => c.trim()).map((c) => [c, row[c]]));

  function builder(kind: Op['kind'], values?: Row) {
    const filters: Filter[] = [];
    let cols = '*';
    let returning = kind === 'select';
    const run = async (mode: 'many' | 'single' | 'maybe') => {
      const op: Op = { kind, values };
      if (db.before) await db.before(op);
      let data: any = null;
      let error: any = null;
      if (kind === 'select') {
        data = db.rows.filter((r) => matches(r, filters)).map((r) => pick(r, cols));
      } else if (kind === 'insert') {
        const dup = db.rows.some((r) => r.user_id === values!.user_id && r.content_item_id === values!.content_item_id);
        if (dup) {
          error = { code: '23505', message: 'duplicate key value violates unique constraint' };
        } else {
          const row = { watch_time: 0, play_count: 0, pause_count: 0, seek_count: 0, ...values };
          db.rows.push(row);
          data = [pick(row, cols)];
        }
      } else {
        const hit = db.rows.filter((r) => matches(r, filters));
        hit.forEach((r) => Object.assign(r, values));
        data = hit.map((r) => pick(r, cols));
      }
      if (!error && db.failAfterCommit?.(op)) {
        return { data: null, error: { message: 'Failed to fetch (response lost after commit)' } };
      }
      if (error) return { data: null, error };
      if (!returning && mode === 'many') return { data: null, error: null };
      if (mode === 'single') {
        return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116' } };
      }
      if (mode === 'maybe') return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };
    const b: any = {
      select(c = '*') { cols = c; returning = true; return b; },
      eq(col: string, value: unknown) { filters.push({ col, value, isNull: false }); return b; },
      is(col: string, value: null) { filters.push({ col, value, isNull: value === null }); return b; },
      single: () => run('single'),
      maybeSingle: () => run('maybe'),
      then: (ok: any, fail: any) => run('many').then(ok, fail),
    };
    return b;
  }

  /** Same semantics as apply_video_engagement_batch: ledger insert + atomic upsert in one step. */
  async function rpc(name: string, args: Row) {
    if (name !== 'apply_video_engagement_batch') throw new Error(`unexpected rpc ${name}`);
    db.rpcCalls += 1;
    if (!db.rpcDeployed) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    const op: Op = { kind: 'rpc', values: args };
    if (db.before) await db.before(op);
    const user = 'u1'; // auth.uid() of the caller in these tests
    const key = `${user}:${args.p_batch_id}`;
    let row = db.rows.find((r) => r.user_id === user && r.content_item_id === args.p_content_item_id);
    let outcome = 'already-applied';
    if (!db.batches.has(key)) {
      db.batches.add(key);
      outcome = 'applied';
      if (!row) {
        row = { user_id: user, content_item_id: args.p_content_item_id, watch_time: 0, play_count: 0, pause_count: 0, seek_count: 0 };
        db.rows.push(row);
      }
      row.watch_time += args.p_watch_time_delta;
      row.play_count += args.p_play_count_delta;
      row.pause_count += args.p_pause_count_delta;
      row.seek_count += args.p_seek_count_delta;
      if (args.p_last_position !== null) row.last_position = args.p_last_position;
    }
    if (db.failAfterCommit?.(op)) return { data: null, error: { message: 'Failed to fetch (response lost after commit)' } };
    const { watch_time, play_count, pause_count, seek_count } = row ?? {};
    return { data: [{ outcome, watch_time, play_count, pause_count, seek_count }], error: null };
  }

  return {
    supabase: {
      rpc,
      from: () => ({
        select: (c = '*') => builder('select').select(c),
        insert: (values: Row) => builder('insert', values),
        update: (values: Row) => builder('update', values),
      }),
    },
  };
});

import videoAnalyticsService from '@/services/videoAnalyticsService';
import { WatchReporter, type EngagementSink } from '../watchReporter';

// The real service is the sink, exactly as TrackedVideoPlayer defaults to it.
const sink = videoAnalyticsService as unknown as EngagementSink;

function reporterFor(userId: string, itemId: string) {
  let t = 0;
  const statuses: string[] = [];
  const reporter = new WatchReporter({
    userId, contentItemId: itemId, sink, now: () => t, flushIntervalMs: 60_000,
    onStatus: (s) => statuses.push(s),
  });
  /** Play `seconds` of real-time video from `from`, then pause (which flushes). */
  const watch = (from: number, seconds: number) => {
    reporter.record({ type: 'play', position: from });
    for (let s = 1; s <= seconds; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: from + s }); }
    reporter.record({ type: 'pause', position: from + seconds });
  };
  return { reporter, watch, statuses };
}

const row = () => db.rows.find((r) => r.user_id === 'u1' && r.content_item_id === 'v1');

beforeEach(() => {
  db.rows = [];
  db.before = null;
  db.failAfterCommit = null;
  db.batches = new Set();
  db.rpcCalls = 0;
  // A fresh service instance per test, so the "RPC missing" fallback flag does not leak between tests.
  (videoAnalyticsService as unknown as { batchRpcUnavailable: boolean }).batchRpcUnavailable = false;
});

/** An existing row, seeded directly so the R3 controls do not depend on the create path. */
const seedRow = (watch_time: number) =>
  db.rows.push({ user_id: 'u1', content_item_id: 'v1', watch_time, play_count: 1, pause_count: 1, seek_count: 0 });

describe('engagement persistence contract (idempotent batch RPC deployed)', () => {
  beforeEach(() => { db.rpcDeployed = true; });

  it('creates an absent row holding exactly the first batch, through the RPC only', async () => {
    const { reporter, watch } = reporterFor('u1', 'v1');
    watch(0, 10);
    await reporter.dispose();
    expect(row()).toMatchObject({ watch_time: 10, play_count: 1, pause_count: 1, seek_count: 0, last_position: 10 });
    expect(db.rpcCalls).toBe(1);
  });

  it('a lost-response batch retried with the same id is applied once', async () => {
    seedRow(5);
    const second = reporterFor('u1', 'v1');
    let lose = true;
    db.failAfterCommit = (op) => op.kind === 'rpc' && lose && !(lose = false);
    second.watch(5, 7);
    await vi.waitFor(() => expect(second.statuses).toContain('error'));
    expect(row()).toMatchObject({ watch_time: 12 });
    await second.reporter.dispose();
    expect(row()).toMatchObject({ watch_time: 12, play_count: 2, pause_count: 2 });
    expect(second.reporter.currentStatus).toBe('saved');
  });

  it('FIXED (was the disclosed limit): a lost-response batch changed by another writer before the retry is not applied twice', async () => {
    const first = reporterFor('u1', 'v1');
    let lose = true;
    db.failAfterCommit = (op) => op.kind === 'rpc' && lose && !(lose = false);
    first.watch(0, 5);
    await vi.waitFor(() => expect(first.statuses).toContain('error'));
    db.failAfterCommit = null;
    const other = reporterFor('u1', 'v1');
    other.watch(0, 3);
    await other.reporter.dispose();
    await first.reporter.dispose();
    expect(row()!.watch_time).toBe(5 + 3);
    expect(first.reporter.currentStatus).toBe('saved');
  });

  it('two overlapping writers both land', async () => {
    seedRow(1);
    const a = reporterFor('u1', 'v1');
    const b = reporterFor('u1', 'v1');
    a.watch(1, 10);
    b.watch(1, 20);
    await Promise.all([a.reporter.dispose(), b.reporter.dispose()]);
    expect(row()).toMatchObject({ watch_time: 1 + 10 + 20, play_count: 3, pause_count: 3 });
  });
});

describe('engagement persistence contract (RPC not deployed: compare-and-set fallback)', () => {
  beforeEach(() => { db.rpcDeployed = false; });

  it('falls back after one missing-function answer and does not ask again', async () => {
    const first = reporterFor('u1', 'v1');
    first.watch(0, 4);
    await first.reporter.dispose();
    const second = reporterFor('u1', 'v1');
    second.watch(4, 2);
    await second.reporter.dispose();
    expect(row()).toMatchObject({ watch_time: 6, pause_count: 2 });
    expect(db.rpcCalls).toBe(1);
  });

  it('R2: an absent row is created holding exactly the first batch (one play, not two)', async () => {
    const { reporter, watch } = reporterFor('u1', 'v1');
    watch(0, 10);
    await reporter.dispose();
    expect(row()).toMatchObject({ watch_time: 10, play_count: 1, pause_count: 1, seek_count: 0, last_position: 10 });
  });

  it('R2: legacy getOrCreateAnalytics still creates with play_count 1 for its existing callers', async () => {
    const created = await videoAnalyticsService.getOrCreateAnalytics('u1', 'v1');
    expect(created).toMatchObject({ play_count: 1, watch_time: 0 });
  });

  it('R3: a write that committed but whose response was lost is not applied twice on retry', async () => {
    seedRow(5);
    const second = reporterFor('u1', 'v1');
    let lose = true;
    db.failAfterCommit = (op) => op.kind === 'update' && lose && !(lose = false);
    second.watch(5, 7);
    await vi.waitFor(() => expect(second.statuses).toContain('error'));
    expect(row()).toMatchObject({ watch_time: 12 }); // it did commit
    await second.reporter.dispose(); // final attempt retries the same batch
    expect(row()!.watch_time).toBe(12); // a blind retry would make it 19
    expect(row()).toMatchObject({ watch_time: 12, play_count: 2, pause_count: 2 });
    expect(second.reporter.currentStatus).toBe('saved');
  });

  it('R3: two overlapping writers for the same user and video do not lose each other\'s increments', async () => {
    seedRow(1);

    // Hold every read until both writers have read the same row, then let them write.
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((r) => { release = r; });
    db.before = async (op) => {
      if (op.kind !== 'select') return;
      reads += 1;
      if (reads === 2) release();
      if (reads <= 2) await bothRead;
    };
    const a = reporterFor('u1', 'v1');
    const b = reporterFor('u1', 'v1');
    a.watch(1, 10);
    b.watch(1, 20);
    await Promise.all([a.reporter.dispose(), b.reporter.dispose()]);
    expect(row()!.watch_time).toBe(1 + 10 + 20); // last-writer-wins would leave 11 or 21
    expect(row()).toMatchObject({ watch_time: 1 + 10 + 20, play_count: 3, pause_count: 3 });
  });

  // Regression guard, NOT a causal control: 4c6544a also ends with watch_time 10 here (its failed insert is retried).
  it('two writers creating the same absent row both land (unique-violation re-read)', async () => {
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((r) => { release = r; });
    db.before = async (op) => {
      if (op.kind !== 'select') return;
      reads += 1;
      if (reads === 2) release();
      if (reads <= 2) await bothRead;
    };
    const a = reporterFor('u1', 'v1');
    const b = reporterFor('u1', 'v1');
    a.watch(0, 4);
    b.watch(0, 6);
    await Promise.all([a.reporter.dispose(), b.reporter.dispose()]);
    expect(db.rows).toHaveLength(1);
    expect(row()).toMatchObject({ watch_time: 10, pause_count: 2 });
  });

  // Pin of the fallback's disclosed limitation, NOT a control. The RPC path above removes it.
  it('DISCLOSED LIMIT (fallback only): a lost-response write that another writer changes before the retry IS applied twice', async () => {
    const first = reporterFor('u1', 'v1');
    let lose = true;
    db.failAfterCommit = (op) => op.kind === 'insert' && lose && !(lose = false);
    first.watch(0, 5);
    await vi.waitFor(() => expect(first.statuses).toContain('error'));
    db.failAfterCommit = null;
    const other = reporterFor('u1', 'v1');
    other.watch(0, 3);
    await other.reporter.dispose();
    await first.reporter.dispose();
    expect(row()!.watch_time).toBe(5 + 3 + 5);
  });
});
