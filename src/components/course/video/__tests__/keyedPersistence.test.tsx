// ABOUTME: Source proof (fake-RPC tier): the REAL WatchReporter + videoAnalyticsService in 'keyed' mode against an
// ABOUTME: in-memory model of the PROPOSED apply-once RPC. No SQL exists; this proves the client side of the contract.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { newFakeKeyedRpcState, type FakeKeyedRpcState } from './support/fakeKeyedRpc';

const rpc = vi.hoisted(() => ({ state: null as unknown as FakeKeyedRpcState }));
vi.mock('@/integrations/supabase/client', async () => {
  const { createFakeKeyedSupabase, newFakeKeyedRpcState: fresh } = await import('./support/fakeKeyedRpc');
  rpc.state = fresh();
  return { supabase: createFakeKeyedSupabase(rpc.state) };
});

import videoAnalyticsService from '@/services/videoAnalyticsService';
import { ProposedBatchLedgerModel } from './support/proposedBatchLedgerModel';
import { WatchReporter, type EngagementSink } from '../watchReporter';
import { TrackedVideoPlayer } from '../TrackedVideoPlayer';

const A = 'learner-a';
const B = 'learner-b';
const V = 'video-1';
const sink = videoAnalyticsService as unknown as EngagementSink;

function keyedReporter(userId = A, session?: string) {
  let t = 0;
  const statuses: string[] = [];
  const reporter = new WatchReporter({
    userId, contentItemId: V, sink, now: () => t, flushIntervalMs: 60_000, persistence: 'keyed',
    makeSessionId: session ? () => session : undefined,
    onStatus: (s) => statuses.push(s),
  });
  /** Play `seconds` from `from` (with one seek forward first if `seekTo` is given), then pause, which flushes. */
  const watch = (from: number, seconds: number, seekTo?: number) => {
    reporter.record({ type: 'play', position: from });
    let p = from;
    if (seekTo !== undefined) { reporter.record({ type: 'seeked', position: seekTo }); p = seekTo; }
    for (let s = 1; s <= seconds; s++) { t += 1000; reporter.record({ type: 'timeupdate', position: p + s }); }
    reporter.record({ type: 'pause', position: p + seconds });
  };
  return { reporter, watch, statuses };
}

const once = () => { let left = true; return () => (left ? !(left = false) : false); };
const row = (user = A) => rpc.state.server.row(user, V);
const applyCalls = () => rpc.state.calls.filter((c) => c.fn === 'apply_video_engagement_batch');
const identity = (p: Record<string, any>) => ({ ...p });

beforeEach(() => {
  rpc.state.server = new ProposedBatchLedgerModel();
  rpc.state.authUserId = A;
  rpc.state.calls.length = 0;
});

describe('keyed persistence: real reporter + service over the proposed-RPC model', () => {
  it('an unknown-commit retry resends the identical session, seq and payload and is applied once', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, 'sess-1');
    const lose = once();
    rpc.state.server.failAfterCommit = () => lose();
    watch(0, 5, 20); // 5 s watched, 1 play, 1 pause, 1 seek
    await vi.waitFor(() => expect(statuses).toContain('error'));
    await reporter.dispose();
    const calls = applyCalls();
    expect(calls).toHaveLength(2);
    expect(identity(calls[1].params)).toEqual(identity(calls[0].params));
    expect(calls[0].params).toMatchObject({ p_session_id: 'sess-1', p_seq: 1, p_expected_user_id: A });
    expect(row()).toEqual({ watch_time: 5, play_count: 1, pause_count: 1, seek_count: 1 });
    expect(reporter.currentStatus).toBe('saved');
  });

  it('holds later progress until the frozen batch is acknowledged, then sends it as the next seq', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, 'sess-1');
    const drop = once();
    rpc.state.server.failBeforeCommit = () => drop();
    watch(0, 3);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    watch(3, 4); // newer progress arrives while seq 1 is unacknowledged; its pause flush retries seq 1 only
    await reporter.dispose();
    const seqs = applyCalls().map((c) => [c.params.p_seq, c.params.p_watch_delta, c.params.p_play_delta, c.params.p_pause_delta]);
    expect(seqs).toEqual([
      [1, 3, 1, 1], // never committed
      [1, 3, 1, 1], // identical retry, not merged with newer progress
      [2, 4, 1, 1], // newer progress only after seq 1 was acknowledged
    ]);
    expect(row()).toEqual({ watch_time: 7, play_count: 2, pause_count: 2, seek_count: 0 });
  });

  it('F1: committed-but-unacknowledged batch is applied exactly once though another session wrote in between (all four counters)', async () => {
    const a = keyedReporter(A, 'sess-a');
    const b = keyedReporter(A, 'sess-b');
    const lose = once();
    rpc.state.server.failAfterCommit = (op) => op.key.sessionId === 'sess-a' && lose();
    a.watch(0, 5, 30);
    await vi.waitFor(() => expect(a.statuses).toContain('error'));
    b.watch(0, 3);
    await b.reporter.dispose();
    await a.reporter.dispose();
    expect(row()).toEqual({ watch_time: 8, play_count: 2, pause_count: 2, seek_count: 1 });
    const aCalls = applyCalls().filter((c) => c.params.p_session_id === 'sess-a');
    expect(aCalls).toHaveLength(2);
    expect(aCalls[1].params).toEqual(aCalls[0].params);
  });

  it('F2: an uncommitted batch is applied even when another session reached its exact totals (all four counters)', async () => {
    const a = keyedReporter(A, 'sess-a');
    const b = keyedReporter(A, 'sess-b');
    const drop = once();
    rpc.state.server.failBeforeCommit = (op) => op.key.sessionId === 'sess-a' && drop();
    a.watch(0, 5, 30);
    await vi.waitFor(() => expect(a.statuses).toContain('error'));
    b.watch(0, 5, 30); // identical deltas: the row now equals what A attempted
    await b.reporter.dispose();
    await a.reporter.dispose();
    expect(row()).toEqual({ watch_time: 10, play_count: 2, pause_count: 2, seek_count: 2 });
    const aCalls = applyCalls().filter((c) => c.params.p_session_id === 'sess-a');
    expect(aCalls.map((c) => c.params.p_seq)).toEqual([1, 1]);
  });

  it('a remount of the real player gets a new session, so its seq 1 is never treated as a duplicate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const o = 'https://www.youtube.com';
      const viewOnce = async () => {
        const { unmount } = render(<TrackedVideoPlayer src={src} userId={A} contentItemId={V} persistence="keyed" />);
        const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
        fireEvent.load(frame);
        const send = (data: unknown) => act(() => {
          window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin: o, source: frame.contentWindow }));
        });
        send({ event: 'infoDelivery', info: { currentTime: 0 } });
        send({ event: 'onStateChange', info: 1 });
        for (let s = 1; s <= 2; s++) { vi.setSystemTime(Date.now() + 1000); send({ event: 'infoDelivery', info: { currentTime: s } }); }
        send({ event: 'onStateChange', info: 2 });
        await vi.waitFor(() => expect(applyCalls().length).toBeGreaterThan(0));
        unmount();
      };
      await viewOnce();
      await viewOnce();
      await vi.waitFor(() => expect(applyCalls()).toHaveLength(2));
      const [first, second] = applyCalls();
      expect(first.params.p_session_id).not.toBe(second.params.p_session_id);
      expect([first.params.p_seq, second.params.p_seq]).toEqual([1, 1]);
      expect(row()).toEqual({ watch_time: 4, play_count: 2, pause_count: 2, seek_count: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('two tabs (two reporters) for the same learner and video have isolated sessions', () => {
    const one = keyedReporter(A);
    const two = keyedReporter(A);
    expect(one.reporter.sessionId).toBeTruthy();
    expect(one.reporter.sessionId).not.toBe(two.reporter.sessionId);
  });

  it('after an account switch, a retired reporter replays nothing under the new learner', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, 'sess-a');
    const drop = once();
    rpc.state.server.failBeforeCommit = () => drop();
    watch(0, 6);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    const callsBefore = applyCalls().length;

    rpc.state.authUserId = B; // learner A signs out, learner B signs in on the same page
    await reporter.retry();
    await reporter.dispose();
    reporter.record({ type: 'play', position: 6 });
    await reporter.flush();

    expect(applyCalls()).toHaveLength(callsBefore); // nothing sent while B is signed in
    expect(row(B)).toBeUndefined();
    expect(row(A)).toBeUndefined();
    expect(reporter.isRetired).toBe(true);
    expect(reporter.hasPending).toBe(false);
  });

  it('keyed mode never re-routes a batch to the CAS path when the keyed RPC is unavailable', async () => {
    const casOnly = { applyEngagementDeltas: vi.fn(async () => undefined) } as unknown as EngagementSink;
    let t = 0;
    const reporter = new WatchReporter({ userId: A, contentItemId: V, sink: casOnly, now: () => t, persistence: 'keyed' });
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 });
    await reporter.dispose();
    expect(casOnly.applyEngagementDeltas).not.toHaveBeenCalled();
    expect(reporter.currentStatus).toBe('error');
    expect(reporter.hasPending).toBe(true);
  });
});
