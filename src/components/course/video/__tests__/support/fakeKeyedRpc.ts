// ABOUTME: Fake supabase client for the PROPOSED keyed RPC: rpc('apply_video_engagement_batch') over the in-memory
// ABOUTME: ProposedBatchLedgerModel, plus a switchable signed-in user. Records every call's exact params.

import { ProposedBatchLedgerModel } from './proposedBatchLedgerModel';

export interface FakeKeyedRpcState {
  server: ProposedBatchLedgerModel;
  /** Signed-in user id, or null when signed out. */
  authUserId: string | null;
  calls: Array<{ fn: string; params: Record<string, any>; authUserId: string | null }>;
}

export const newFakeKeyedRpcState = (): FakeKeyedRpcState => ({
  server: new ProposedBatchLedgerModel(),
  authUserId: 'learner-a',
  calls: [],
});

export function createFakeKeyedSupabase(state: FakeKeyedRpcState) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: state.authUserId ? { user: { id: state.authUserId } } : null },
        error: null,
      }),
    },
    rpc: async (fn: string, params: Record<string, any>) => {
      state.calls.push({ fn, params: { ...params }, authUserId: state.authUserId });
      if (fn !== 'apply_video_engagement_batch') return { data: null, error: { message: `unknown rpc ${fn}` } };
      // Proposed server rule: the caller's auth.uid() must equal p_expected_user_id.
      if (!state.authUserId || state.authUserId !== params.p_expected_user_id) {
        return { data: null, error: { code: '42501', message: 'expected user mismatch' } };
      }
      try {
        const { applied, totals } = await state.server.applyBatch(
          { userId: state.authUserId, contentItemId: params.p_content_item_id, sessionId: params.p_session_id, seq: params.p_seq },
          {
            watch_time: params.p_watch_delta,
            play_count: params.p_play_delta,
            pause_count: params.p_pause_delta,
            seek_count: params.p_seek_delta,
          },
        );
        return { data: [{ applied, ...totals }], error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    from: () => {
      throw new Error('keyed path must not touch tables directly');
    },
  };
}
