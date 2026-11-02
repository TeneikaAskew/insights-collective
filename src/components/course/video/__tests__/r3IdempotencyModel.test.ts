// ABOUTME: R3 design proofs (fake-model tier only): the same three failure scenarios run against the CURRENT
// ABOUTME: c5b7caf contract (expected to fail, it.fails) and the PROPOSED keyed apply-once model (expected to pass).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newFakeTableState, type FakeTableState } from './support/fakeVideoAnalyticsTable';
import { KeyedWriterModel, ProposedBatchLedgerModel, type BatchDeltas } from './support/proposedBatchLedgerModel';

const table = vi.hoisted(() => ({ state: null as unknown as FakeTableState }));
vi.mock('@/integrations/supabase/client', async () => {
  const { createFakeSupabase, newFakeTableState: fresh } = await import('./support/fakeVideoAnalyticsTable');
  table.state = fresh();
  return { supabase: createFakeSupabase(table.state) };
});

import videoAnalyticsService, { type EngagementDeltas, type EngagementTotals } from '@/services/videoAnalyticsService';

const U = 'u1';
const V = 'v1';
const batch = (watch: number, play = 1, pause = 1, seek = 0): BatchDeltas => ({
  watch_time: watch, play_count: play, pause_count: pause, seek_count: seek,
});
const asServiceDeltas = (d: BatchDeltas): EngagementDeltas => ({
  watchTimeDelta: d.watch_time, playCountDelta: d.play_count, pauseCountDelta: d.pause_count, seekCountDelta: d.seek_count,
});

/**
 * Client side of the CURRENT contract, mirroring WatchReporter at c5b7caf:
 * a failed batch is frozen and retried unchanged, with expectTarget taken
 * from EngagementWriteUncertainError.attemptedTarget.
 */
class CurrentWriter {
  private frozen: { deltas: BatchDeltas; expectTarget: EngagementTotals | null } | null = null;
  async submit(deltas?: BatchDeltas): Promise<'saved' | 'error'> {
    if (!this.frozen) {
      if (!deltas) return 'saved';
      this.frozen = { deltas, expectTarget: null };
    }
    const attempt = this.frozen;
    try {
      await videoAnalyticsService.applyEngagementDeltas(U, V, asServiceDeltas(attempt.deltas),
        attempt.expectTarget ? { expectTarget: attempt.expectTarget } : {});
      this.frozen = null;
      return 'saved';
    } catch (error) {
      const target = (error as { attemptedTarget?: EngagementTotals }).attemptedTarget ?? null;
      this.frozen = { deltas: attempt.deltas, expectTarget: target ?? attempt.expectTarget };
      return 'error';
    }
  }
  retry() { return this.submit(); }
}

const currentRow = () => table.state.rows.find((r) => r.user_id === U && r.content_item_id === V);

beforeEach(() => {
  table.state.rows.length = 0;
  table.state.before = null;
  table.state.failBeforeCommit = null;
  table.state.failAfterCommit = null;
});

const once = () => { let left = true; return () => (left ? !(left = false) : false); };

describe('CURRENT contract at c5b7caf (fake table): each property is expected to FAIL', () => {
  it.fails('F1: a committed-but-unacknowledged batch is applied exactly once after another writer intervenes', async () => {
    const a = new CurrentWriter();
    const b = new CurrentWriter();
    const lose = once();
    table.state.failAfterCommit = (op) => op.kind !== 'select' && lose();
    expect(await a.submit(batch(5))).toBe('error'); // committed, response lost
    expect(await b.submit(batch(3))).toBe('saved');
    expect(await a.retry()).toBe('saved');
    expect(currentRow()!.watch_time).toBe(8); // actual: 13
  });

  it.fails('F2: an uncommitted batch is not dropped when another writer happens to reach its attempted totals', async () => {
    const a = new CurrentWriter();
    const b = new CurrentWriter();
    const drop = once();
    table.state.failBeforeCommit = (op) => op.kind !== 'select' && drop();
    expect(await a.submit(batch(5))).toBe('error'); // never committed, outcome unknown to A
    expect(await b.submit(batch(5))).toBe('saved'); // same totals A attempted
    expect(await a.retry()).toBe('saved');
    expect(currentRow()!.watch_time).toBe(10); // actual: 5 (A treated as already applied)
  });

  it.fails('F3: a batch is applied in one call while other writers keep changing the row (liveness)', async () => {
    table.state.rows.push({ user_id: U, content_item_id: V, watch_time: 0, play_count: 0, pause_count: 0, seek_count: 0 });
    // Another writer commits just before each of A's compare-and-set updates.
    table.state.before = (op) => { if (op.kind === 'update') currentRow()!.watch_time += 1; };
    const a = new CurrentWriter();
    expect(await a.submit(batch(5))).toBe('saved'); // actual: 'error' (EngagementConflictError after 3 rounds)
  });
});

describe('PROPOSED keyed apply-once model: the same properties hold', () => {
  let server: ProposedBatchLedgerModel;
  beforeEach(() => { server = new ProposedBatchLedgerModel(); });
  const writer = (session: string) => new KeyedWriterModel(server, U, V, session);

  it('F1: a committed-but-unacknowledged batch is applied exactly once after another writer intervenes', async () => {
    const a = writer('session-a');
    const b = writer('session-b');
    const lose = once();
    server.failAfterCommit = () => lose();
    expect(await a.submit(batch(5))).toBe('error');
    expect(await b.submit(batch(3))).toBe('saved');
    expect(await a.retry()).toBe('saved');
    expect(server.row(U, V)!.watch_time).toBe(8);
  });

  it('F2: an uncommitted batch is not dropped when another writer happens to reach its attempted totals', async () => {
    const a = writer('session-a');
    const b = writer('session-b');
    const drop = once();
    server.failBeforeCommit = () => drop();
    expect(await a.submit(batch(5))).toBe('error');
    expect(await b.submit(batch(5))).toBe('saved');
    expect(await a.retry()).toBe('saved');
    expect(server.row(U, V)!.watch_time).toBe(10);
  });

  it('F3: a batch is applied in one call while other writers keep changing the row', async () => {
    const a = writer('session-a');
    const others = writer('session-other');
    server.before = async (op) => {
      if (op.key.sessionId === 'session-a') { server.before = null; await others.submit(batch(1, 0, 0)); }
    };
    expect(await a.submit(batch(5))).toBe('saved');
    expect(server.row(U, V)!.watch_time).toBe(6);
  });

  it('a remount or second tab is a new session, so its seq 1 is never mistaken for a duplicate', async () => {
    expect(await writer('mount-1').submit(batch(4))).toBe('saved');
    expect(await writer('mount-2').submit(batch(4))).toBe('saved');
    expect(server.row(U, V)).toEqual(batch(8, 2, 2));
  });

  it('a retried seq that already committed is acknowledged without being applied again (same session)', async () => {
    const a = writer('session-a');
    const lose = once();
    server.failAfterCommit = () => lose();
    expect(await a.submit(batch(5))).toBe('error');
    expect(await a.retry()).toBe('saved');
    expect(await a.submit(batch(2))).toBe('saved');
    expect(server.row(U, V)!.watch_time).toBe(7);
    expect(server.highWater.get(`${U}|${V}|session-a`)).toBe(2);
  });
});
