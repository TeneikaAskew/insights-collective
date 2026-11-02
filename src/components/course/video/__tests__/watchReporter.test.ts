// ABOUTME: Unit tests for WatchReporter batching against a fake EngagementSink.

import { describe, expect, it, vi } from 'vitest';
import { WatchReporter, type EngagementSink } from '../watchReporter';

function setup(overrides: Partial<ConstructorParameters<typeof WatchReporter>[0]> = {}) {
  let t = 0;
  const calls: Array<Record<string, unknown>> = [];
  const sink: EngagementSink = {
    updateEngagement: vi.fn(async (_u, _c, update) => { calls.push(update as Record<string, unknown>); }),
  };
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
    expect(sink.updateEngagement).toHaveBeenCalledWith('user-1', 'item-1', expect.any(Object));
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
    const sink: EngagementSink = {
      updateEngagement: vi.fn(async (_u, _c, update) => {
        attempts.push(update as Record<string, unknown>);
        if (attempts.length === 1) throw new Error('offline');
      }),
    };
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
      sink: { updateEngagement: async (_u, _c, update) => { calls.push(update as Record<string, unknown>); } },
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
    const sink: EngagementSink = {
      updateEngagement: vi.fn((_u, _c, update) => {
        calls.push(update as Record<string, unknown>);
        return calls.length === 1 ? new Promise<void>((r) => { release = r; }) : Promise.resolve();
      }),
    };
    const reporter = new WatchReporter({ userId: 'u', contentItemId: 'c', sink, now: () => t });
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 });
    reporter.record({ type: 'play', position: 1 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 2 });
    reporter.record({ type: 'pause', position: 2 });
    expect(sink.updateEngagement).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(sink.updateEngagement).toHaveBeenCalledTimes(2));
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
});
