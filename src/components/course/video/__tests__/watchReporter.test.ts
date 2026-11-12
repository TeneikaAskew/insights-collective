// ABOUTME: Unit tests for WatchReporter batching against a fake EngagementSink.

import { describe, expect, it, vi } from 'vitest';
import { WatchReporter, type EngagementSink } from '../watchReporter';

/** One mock under both method names, so these tests also run unchanged against older heads (receipts). */
function dualSink(impl: (...args: any[]) => Promise<unknown>) {
  const fn = vi.fn(impl);
  return { fn, sink: { applyEngagementDeltas: fn, updateEngagement: fn } as unknown as EngagementSink };
}

function setup(overrides: Partial<ConstructorParameters<typeof WatchReporter>[0]> = {}) {
  let t = 0;
  const calls: Array<Record<string, unknown>> = [];
  const { sink } = dualSink(async (_u, _c, update) => { calls.push(update as Record<string, unknown>); });
  const reporter = new WatchReporter({
    userId: 'user-1', contentItemId: 'item-1', sink, now: () => t, flushIntervalMs: 15000, ...overrides,
  });
  const playSeconds = (from: number, to: number) => {
    for (let s = from + 1; s <= to; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: s }); }
  };
  return { reporter, sink, calls, playSeconds, advance: (ms: number) => { t += ms; } };
}

describe('WatchReporter', () => {
  it('flushes on pause with deltas, without completion percentage by default', async () => {
    const { reporter, sink, calls, playSeconds } = setup();
    reporter.record({ type: 'ready', duration: 100 });
    reporter.record({ type: 'play', position: 0 });
    playSeconds(0, 10);
    reporter.record({ type: 'pause', position: 10 });
    await reporter.flush();
    expect(vi.mocked(sink.applyEngagementDeltas).mock.calls[0].slice(0, 2)).toEqual(['user-1', 'item-1']);
    expect(calls).toEqual([
      { lastPosition: 10, playbackSpeed: 1, watchTimeDelta: 10, playCountDelta: 1, pauseCountDelta: 1, videoDuration: 100 },
    ]);
    expect(calls[0]).not.toHaveProperty('completionPercentage');
    expect(reporter.currentStatus).toBe('saved');
  });

  it('sends coverage percent only when explicitly enabled', async () => {
    const { reporter, calls, playSeconds } = setup({ reportCoveragePercent: true });
    reporter.record({ type: 'ready', duration: 40 });
    reporter.record({ type: 'play', position: 0 });
    playSeconds(0, 10);
    reporter.record({ type: 'pause', position: 10 });
    await reporter.flush();
    expect(calls[0]).toMatchObject({ completionPercentage: 25 });
  });

  it('flushes on the interval while playing, then only sends new deltas', async () => {
    const { reporter, calls, playSeconds } = setup();
    reporter.record({ type: 'play', position: 0 });
    playSeconds(0, 15); // 15s of wall time triggers an interval flush
    await reporter.flush();
    playSeconds(15, 20);
    reporter.record({ type: 'pause', position: 20 });
    await reporter.flush();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ watchTimeDelta: 15, playCountDelta: 1, lastPosition: 15 });
    expect(calls[1]).toMatchObject({ watchTimeDelta: 5, pauseCountDelta: 1, lastPosition: 20 });
    expect(calls[1]).not.toHaveProperty('playCountDelta');
  });

  it('keeps deltas pending after a failed write and retries the same totals', async () => {
    let t = 0;
    const attempts: Array<Record<string, unknown>> = [];
    const statuses: string[] = [];
    const { sink } = dualSink(async (_u, _c, update) => {
      attempts.push(update as Record<string, unknown>);
      if (attempts.length === 1) throw new Error('offline');
    });
    const reporter = new WatchReporter({
      userId: 'user-1', contentItemId: 'item-1', sink, now: () => t, onStatus: (st) => statuses.push(st),
    });
    reporter.record({ type: 'play', position: 0 });
    for (let s = 1; s <= 4; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: s }); }
    reporter.record({ type: 'pause', position: 4 }); // auto flush #1 (fails)
    await vi.waitFor(() => expect(statuses).toContain('error'));
    expect(reporter.currentStatus).toBe('error');
    await reporter.flush(); // retry
    const expected = { lastPosition: 4, playbackSpeed: 1, watchTimeDelta: 4, playCountDelta: 1, pauseCountDelta: 1 };
    expect(attempts).toEqual([expected, expected]);
    expect(reporter.currentStatus).toBe('saved');
    await reporter.flush();
    expect(attempts).toHaveLength(2); // nothing new, no write
  });

  it('keeps fractional seconds pending instead of rounding them away', async () => {
    let t = 0;
    const calls: Array<Record<string, unknown>> = [];
    const reporter = new WatchReporter({
      userId: 'u', contentItemId: 'c', now: () => t,
      sink: dualSink(async (_u, _c, update) => { calls.push(update as Record<string, unknown>); }).sink,
    });
    reporter.record({ type: 'play', position: 0 });
    t += 1500; reporter.record({ type: 'timeupdate', position: 1.5 });
    reporter.record({ type: 'pause', position: 1.5 });
    await reporter.flush();
    reporter.record({ type: 'play', position: 1.5 });
    t += 1500; reporter.record({ type: 'timeupdate', position: 3 });
    reporter.record({ type: 'pause', position: 3 });
    await reporter.flush();
    expect(calls.map((c) => c.watchTimeDelta)).toEqual([1, 2]);
  });

  it('allows one write in flight and folds later events into a follow-up write', async () => {
    let release!: () => void;
    const calls: Array<Record<string, unknown>> = [];
    let t = 0;
    const { sink } = dualSink((_u, _c, update) => {
      calls.push(update as Record<string, unknown>);
      return calls.length === 1 ? new Promise<void>((r) => { release = r; }) : Promise.resolve();
    });
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 });
    reporter.record({ type: 'play', position: 1 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 2 });
    reporter.record({ type: 'pause', position: 2 });
    expect(sink.applyEngagementDeltas).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(sink.applyEngagementDeltas).toHaveBeenCalledTimes(2));
    expect(calls[1]).toMatchObject({ watchTimeDelta: 1, playCountDelta: 1, pauseCountDelta: 1 });
  });

  it('ignores events after dispose', async () => {
    const { reporter, calls } = setup();
    await reporter.dispose();
    reporter.record({ type: 'play', position: 0 });
    reporter.record({ type: 'pause', position: 0 });
    await reporter.flush();
    expect(calls).toHaveLength(0);
  });

  // Review R3 (#164 4c6544a): dispose is a real drain, and a failed batch is retried as the identical batch.
  it('dispose waits for the follow-up write queued behind the one in flight', async () => {
    let t = 0;
    const settle: Array<() => void> = [];
    const calls: unknown[] = [];
    const impl = vi.fn((_u: string, _c: string, update: unknown) => {
      calls.push(update);
      return new Promise<void>((resolve) => { settle.push(resolve); });
    });
    const sink = { applyEngagementDeltas: impl, updateEngagement: impl } as unknown as EngagementSink;
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 }); // write 1 in flight
    reporter.record({ type: 'play', position: 1 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 2 });
    let disposed = false;
    const done = reporter.dispose().then(() => { disposed = true; });
    settle[0]();
    await vi.waitFor(() => expect(impl).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(disposed).toBe(false); // still waiting for write 2
    settle[1]();
    await done;
    expect(reporter.currentStatus).toBe('saved');
    expect(calls[1]).toMatchObject({ watchTimeDelta: 1, playCountDelta: 1 });
  });

  it('retries a failed batch unchanged even when newer progress arrived, then sends the newer progress', async () => {
    let t = 0;
    const calls: Array<Record<string, unknown>> = [];
    let fail = true;
    const impl = vi.fn(async (_u: string, _c: string, update: unknown) => {
      calls.push(update as Record<string, unknown>);
      if (fail) { fail = false; throw new Error('offline'); }
    });
    const sink = { applyEngagementDeltas: impl, updateEngagement: impl } as unknown as EngagementSink;
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    for (let s = 1; s <= 3; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: s }); }
    reporter.record({ type: 'pause', position: 3 });
    await vi.waitFor(() => expect(reporter.currentStatus).toBe('error'));
    reporter.record({ type: 'play', position: 3 });
    for (let s = 4; s <= 5; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: s }); }
    await reporter.dispose();
    expect(calls).toHaveLength(3);
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toMatchObject({ watchTimeDelta: 2, playCountDelta: 1 });
    expect(calls[2]).not.toHaveProperty('pauseCountDelta');
  });

  it('passes the attempted totals of an uncertain write back as expectTarget on the retry', async () => {
    let t = 0;
    const options: unknown[] = [];
    const target = { watch_time: 3, play_count: 1, pause_count: 1, seek_count: 0 };
    let n = 0;
    const { sink } = dualSink(async (_u, _c, _d, o) => {
      options.push(o);
      if (n++ === 0) throw Object.assign(new Error('lost response'), { attemptedTarget: target });
    });
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    for (let s = 1; s <= 3; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: s }); }
    reporter.record({ type: 'pause', position: 3 });
    await vi.waitFor(() => expect(reporter.currentStatus).toBe('error'));
    await reporter.flush();
    const [first, retry] = options as Array<{ batchId: string; expectTarget?: unknown }>;
    expect(first).toEqual({ batchId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    // The retry is the identical batch: same durable id, plus what the lost write tried to store.
    expect(retry).toEqual({ batchId: first.batchId, expectTarget: target });
    expect(reporter.currentStatus).toBe('saved');
  });

  it('gives each new batch its own id', async () => {
    let t = 0;
    const ids: string[] = [];
    const { sink } = dualSink(async (_u, _c, _d, o) => { ids.push((o as { batchId: string }).batchId); });
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 });
    await reporter.flush();
    reporter.record({ type: 'play', position: 1 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 2 });
    reporter.record({ type: 'pause', position: 2 });
    await reporter.flush();
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
