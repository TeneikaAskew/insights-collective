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
import { WatchReporter, secureSessionId, type EngagementSink } from '../watchReporter';
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
  rpc.state.authReads = 0;
  rpc.state.authReadFault = null;
  rpc.state.afterAuthRead = null;
  rpc.state.ackOverride = null;
});

describe('keyed persistence: real reporter + service over the proposed-RPC model', () => {
  it('an unknown-commit retry resends the identical session, seq and payload and is applied once', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, '00000000-0000-4000-8000-000000000001');
    const lose = once();
    rpc.state.server.failAfterCommit = () => lose();
    watch(0, 5, 20); // 5 s watched, 1 play, 1 pause, 1 seek
    await vi.waitFor(() => expect(statuses).toContain('error'));
    await reporter.dispose();
    const calls = applyCalls();
    expect(calls).toHaveLength(2);
    expect(identity(calls[1].params)).toEqual(identity(calls[0].params));
    expect(calls[0].params).toMatchObject({ p_session_id: '00000000-0000-4000-8000-000000000001', p_seq: 1, p_expected_user_id: A });
    expect(row()).toEqual({ watch_time: 5, play_count: 1, pause_count: 1, seek_count: 1 });
    expect(reporter.currentStatus).toBe('saved');
  });

  it('holds later progress until the frozen batch is acknowledged, then sends it as the next seq', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, '00000000-0000-4000-8000-000000000001');
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
    const a = keyedReporter(A, '00000000-0000-4000-8000-00000000000a');
    const b = keyedReporter(A, '00000000-0000-4000-8000-00000000000b');
    const lose = once();
    rpc.state.server.failAfterCommit = (op) => op.key.sessionId === '00000000-0000-4000-8000-00000000000a' && lose();
    a.watch(0, 5, 30);
    await vi.waitFor(() => expect(a.statuses).toContain('error'));
    b.watch(0, 3);
    await b.reporter.dispose();
    await a.reporter.dispose();
    expect(row()).toEqual({ watch_time: 8, play_count: 2, pause_count: 2, seek_count: 1 });
    const aCalls = applyCalls().filter((c) => c.params.p_session_id === '00000000-0000-4000-8000-00000000000a');
    expect(aCalls).toHaveLength(2);
    expect(aCalls[1].params).toEqual(aCalls[0].params);
  });

  it('F2: an uncommitted batch is applied even when another session reached its exact totals (all four counters)', async () => {
    const a = keyedReporter(A, '00000000-0000-4000-8000-00000000000a');
    const b = keyedReporter(A, '00000000-0000-4000-8000-00000000000b');
    const drop = once();
    rpc.state.server.failBeforeCommit = (op) => op.key.sessionId === '00000000-0000-4000-8000-00000000000a' && drop();
    a.watch(0, 5, 30);
    await vi.waitFor(() => expect(a.statuses).toContain('error'));
    b.watch(0, 5, 30); // identical deltas: the row now equals what A attempted
    await b.reporter.dispose();
    await a.reporter.dispose();
    expect(row()).toEqual({ watch_time: 10, play_count: 2, pause_count: 2, seek_count: 2 });
    const aCalls = applyCalls().filter((c) => c.params.p_session_id === '00000000-0000-4000-8000-00000000000a');
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
    const { reporter, watch, statuses } = keyedReporter(A, '00000000-0000-4000-8000-00000000000a');
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

const SID = '00000000-0000-4000-8000-0000000000c1';

// Terminal review of 0fe62eb, item 1: an auth-read FAULT is not a mismatch.
describe('identity: auth-read faults vs established mismatches', () => {
  for (const fault of ['error', 'throw', 'no-data'] as const) {
    it(`auth read ${fault}: zero RPC, batch kept, then recovered with the identical key`, async () => {
      const { reporter, watch, statuses } = keyedReporter(A, SID);
      const failOnce = once();
      rpc.state.authReadFault = () => (failOnce() ? fault : null);
      watch(0, 4);
      await vi.waitFor(() => expect(statuses).toContain('error'));
      expect(applyCalls()).toHaveLength(0);
      expect(reporter.isRetired).toBe(false);
      expect(reporter.hasPending).toBe(true);
      await reporter.dispose();
      expect(applyCalls()).toHaveLength(1);
      expect(applyCalls()[0].params).toMatchObject({ p_session_id: SID, p_seq: 1, p_watch_delta: 4 });
      expect(row()).toEqual({ watch_time: 4, play_count: 1, pause_count: 1, seek_count: 0 });
      expect(reporter.currentStatus).toBe('saved');
    });
  }

  it('established sign-out (successful read, no session): zero RPC and the reporter retires', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, SID);
    rpc.state.authUserId = null;
    watch(0, 4);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    await reporter.dispose();
    expect(applyCalls()).toHaveLength(0);
    expect(reporter.isRetired).toBe(true);
  });

  it('A observed at preflight but B signed in at dispatch: the RPC is refused by p_expected_user_id, zero writes, retired', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, SID);
    const switchOnce = once();
    rpc.state.afterAuthRead = () => { if (switchOnce()) rpc.state.authUserId = B; };
    watch(0, 4);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    await reporter.dispose();
    const calls = applyCalls();
    expect(calls).toHaveLength(1); // dispatched (unlike the preflight case), then refused
    expect(calls[0]).toMatchObject({ authUserId: B, params: { p_expected_user_id: A } });
    expect(rpc.state.authReads).toBe(1); // the server's refusal itself retired it: no further attempt
    expect(row(A)).toBeUndefined();
    expect(row(B)).toBeUndefined();
    expect(reporter.isRetired).toBe(true);
    expect(reporter.hasPending).toBe(false);
  });
});

// Terminal review of 0fe62eb, item 2: only exactly one well-formed acknowledgement counts.
describe('acknowledgement shape', () => {
  const malformed: Array<[string, (real: any) => unknown]> = [
    ['empty object', () => ({})],
    ['array of empty object', () => [{}]],
    ['two rows', (real) => [real[0], real[0]]],
    ['empty array', () => []],
    ['applied not boolean', (real) => [{ ...real[0], applied: 'true' }]],
    ['missing a total', (real) => { const { seek_count: _s, ...rest } = real[0]; return [rest]; }],
    ['negative total', (real) => [{ ...real[0], watch_time: -1 }]],
    ['non-integer total', (real) => [{ ...real[0], play_count: 1.5 }]],
    ['bare object (not array)', (real) => real[0]],
  ];
  for (const [label, shape] of malformed) {
    it(`${label}: stays uncertain, held progress does not advance, identical-key retry is applied once`, async () => {
      const { reporter, watch, statuses } = keyedReporter(A, SID);
      const bad = once();
      rpc.state.ackOverride = (real) => (bad() ? shape(real) : real);
      watch(0, 3, 10);
      await vi.waitFor(() => expect(statuses).toContain('error'));
      expect(reporter.hasPending).toBe(true);
      watch(13, 2); // later progress: its pause flush must retry seq 1, not send seq 2
      await reporter.dispose();
      const calls = applyCalls();
      expect(calls.map((c) => c.params.p_seq)).toEqual([1, 1, 2]);
      expect(calls[1].params).toEqual(calls[0].params);
      expect(row()).toEqual({ watch_time: 5, play_count: 2, pause_count: 2, seek_count: 1 });
    });
  }

  it('a persistently malformed ack never advances and never falls back to CAS', async () => {
    const casSpy = vi.spyOn(videoAnalyticsService, 'applyEngagementDeltas');
    const { reporter, watch, statuses } = keyedReporter(A, SID);
    rpc.state.ackOverride = () => [{}];
    watch(0, 3);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    watch(3, 2);
    await reporter.dispose();
    expect(new Set(applyCalls().map((c) => c.params.p_seq))).toEqual(new Set([1]));
    expect(casSpy).not.toHaveBeenCalled();
    expect(reporter.currentStatus).toBe('error');
    expect(reporter.hasPending).toBe(true);
    casSpy.mockRestore();
  });
});

// Terminal review of 0fe62eb, item 3: session ids are UUIDs from a CSPRNG, or nothing is sent.
describe('session id', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('without crypto.randomUUID, falls back to getRandomValues and still produces a v4 UUID', () => {
    const fakeCrypto = { getRandomValues: (a: Uint8Array) => { a.fill(0xab); return a; } } as unknown as Crypto;
    const id = secureSessionId(fakeCrypto);
    expect(id).toMatch(V4);
    expect(secureSessionId({ randomUUID: () => '11111111-1111-4111-8111-111111111111' } as unknown as Crypto))
      .toBe('11111111-1111-4111-8111-111111111111');
  });

  it('with no CSPRNG at all, fails closed: no session id, zero RPC, batch kept, never CAS', async () => {
    expect(secureSessionId({} as Crypto)).toBeNull();
    const casSpy = vi.spyOn(videoAnalyticsService, 'applyEngagementDeltas');
    const statuses: string[] = [];
    let t = 0;
    const reporter = new WatchReporter({
      userId: A, contentItemId: V, sink, now: () => t, persistence: 'keyed',
      makeSessionId: () => secureSessionId({} as Crypto), onStatus: (st) => statuses.push(st),
    });
    expect(reporter.sessionId).toBeNull();
    reporter.record({ type: 'play', position: 0 });
    t += 1000; reporter.record({ type: 'timeupdate', position: 1 });
    reporter.record({ type: 'pause', position: 1 });
    await reporter.dispose();
    expect(applyCalls()).toHaveLength(0);
    expect(casSpy).not.toHaveBeenCalled();
    expect(reporter.hasPending).toBe(true);
    casSpy.mockRestore();
  });

  it('a non-UUID session id (e.g. the old time/Math.random fallback) is refused, not sent', async () => {
    const { reporter, watch, statuses } = keyedReporter(A, 's-lx2k9-4fz1q8');
    expect(reporter.sessionId).toBeNull();
    watch(0, 2);
    await vi.waitFor(() => expect(statuses).toContain('error'));
    await reporter.dispose();
    expect(applyCalls()).toHaveLength(0);
  });

  it('the service itself refuses a non-UUID p_session_id without calling the RPC', async () => {
    await expect(videoAnalyticsService.applyEngagementBatch(A, V, { sessionId: 'not-a-uuid', seq: 1, deltas: { watchTimeDelta: 1 } }))
      .rejects.toThrow(/not a UUID/);
    expect(applyCalls()).toHaveLength(0);
    expect(rpc.state.authReads).toBe(0);
  });

  it('default reporter session ids are v4 UUIDs', () => {
    expect(keyedReporter(A).reporter.sessionId).toMatch(V4);
  });
});

