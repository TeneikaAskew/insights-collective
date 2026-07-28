// ABOUTME: Unit tests for the conversation service's session gate.
// ABOUTME: A call made before supabase-js has a session sends the anon key, and
// ABOUTME: messages-helper answers 401 — so it must not be made at all.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchUserConversations,
  fetchArchivedUserConversations,
  fetchDeletedUserConversations,
} from '../conversationService';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const USER = 'user-1';

/** What `supabase.auth.getSession()` returns once restoration has completed. */
function withSession() {
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'member-token', user: { id: USER } } },
    error: null,
  });
}

/** The cold-load state: the client has not attached a session yet. */
function withoutSession() {
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.functions.invoke.mockResolvedValue({
    data: { conversations: [{ id: 'c-1' }] },
    error: null,
  });
});

const CASES = [
  ['fetchUserConversations', fetchUserConversations, 'getConversations'],
  ['fetchArchivedUserConversations', fetchArchivedUserConversations, 'getArchivedConversations'],
  ['fetchDeletedUserConversations', fetchDeletedUserConversations, 'getDeletedConversations'],
] as const;

describe('conversationService session gate', () => {
  /**
   * The defect this closes: the inbox hooks fetch from a mount effect that can
   * beat session restoration, `functions.invoke` sends whatever bearer the
   * client currently holds, and messages-helper rejects the anon key. Three
   * messaging specs failed in CI with "Edge Function returned a non-2xx status
   * code" for exactly this reason.
   */
  it.each(CASES)('%s does not invoke the function before a session exists', async (_name, fn) => {
    withoutSession();

    await expect(fn(USER)).resolves.toEqual([]);
    expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
  });

  it.each(CASES)('%s invokes with the right action once a session exists', async (_name, fn, action) => {
    withSession();

    await expect(fn(USER)).resolves.toEqual([{ id: 'c-1' }]);
    expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('messages-helper', {
      body: { action, userId: USER },
    });
  });

  /**
   * The gate must not become a way for real failures to read as "no messages" —
   * that is the silent-empty pattern this branch exists to remove. With a
   * session present, an error still propagates.
   */
  it.each(CASES)('%s still throws when the function errors', async (_name, fn) => {
    withSession();
    mockSupabaseClient.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    await expect(fn(USER)).rejects.toThrow(/non-2xx/);
  });
});
