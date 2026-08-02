// ABOUTME: Regression tests for useConversationMessages.
// ABOUTME: Fetch failures must toast; mark-as-read failures are telemetry and must warn without breaking the loaded messages.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversationMessages } from '../useConversationMessages';
import {
  supabaseError,
  getQueryBuilder,
  mockSupabaseClient,
} from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { mockToast, mockLogger } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockLogger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => mockLogger,
}));

vi.mock('@/utils/profileUtils', () => ({
  enrichProfileWithRoles: (profile: any) => ({ ...profile, roles: ['student'] }),
}));

const messageRow = {
  id: 'msg-1',
  sender_id: 'other-user',
  conversation_id: 'conv-1',
  content: 'Hello',
  attachment_url: null,
  read: false,
  created_at: '2026-01-01T00:00:00Z',
  sender: { id: 'other-user', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
};

describe('useConversationMessages', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
  });

  it('toasts when the messages fetch fails and leaves messages empty', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementationOnce((resolve: (value: unknown) => void) =>
      resolve(supabaseError('messages fetch failed'))
    );

    const { result } = renderHook(() => useConversationMessages('conv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('warns (without breaking the loaded messages) when the mark-as-read write fails', async () => {
    const builder = getQueryBuilder();
    builder.then
      // 1st await: messages fetch succeeds
      .mockImplementationOnce((resolve: (value: unknown) => void) =>
        resolve({ data: [messageRow], error: null })
      );
    // mark-as-read is an RPC, not a table update — see the note on the write test below.
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValueOnce(supabaseError('mark read failed') as any);

    const { result } = renderHook(() => useConversationMessages('conv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('mark messages as read'),
      expect.objectContaining({ message: 'mark read failed' })
    );
    // Read receipts are non-critical: no destructive toast for this.
    expect(mockToast).not.toHaveBeenCalled();
  });

  /**
   * The write used to fire on every visit. On an already-read thread it
   * matched nothing, and PostgREST answered 204 with zero rows — which the
   * Supabase instrumentation reports as an empty write, correctly, because
   * from the request alone "nothing left to mark" and "RLS filtered every row"
   * are indistinguishable. /messages/:id showed "1 failed query" on a healthy
   * page. The thread has just been fetched, so the precondition is already in
   * hand.
   */
  it('does not write when every message is already read', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementationOnce((resolve: (value: unknown) => void) =>
      resolve({ data: [{ ...messageRow, read: true }], error: null })
    );

    const { result } = renderHook(() => useConversationMessages('conv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('does not write when the only unread message is your own', async () => {
    // You cannot have an unread message from yourself, so this filters to
    // nothing server-side too — the same empty write, from the other direction.
    const builder = getQueryBuilder();
    builder.then.mockImplementationOnce((resolve: (value: unknown) => void) =>
      resolve({ data: [{ ...messageRow, sender_id: 'user-1', read: false }], error: null })
    );

    const { result } = renderHook(() => useConversationMessages('conv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  /**
   * Through mark_conversation_read, not `.from('messages').update({ read: true })`.
   *
   * The table write could never mark anything: the only UPDATE policy on `messages` is
   * `sender_id = auth.uid()`, and every row a recipient wants to flag is a row somebody
   * else sent. It matched zero rows and returned no error, so received messages kept
   * their unread styling forever. Confirmed against the live database on 2026-08-02 —
   * 0 rows updated via the table, 1 via the RPC. The policy is not widened instead
   * because RLS cannot scope an UPDATE to a single column, so anyone allowed to set
   * `read` would also be allowed to rewrite the sender's `content`.
   */
  it('marks the thread read through the RPC when there is something to mark', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementationOnce((resolve: (value: unknown) => void) =>
      resolve({ data: [messageRow], error: null })
    );

    const { result } = renderHook(() => useConversationMessages('conv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('mark_conversation_read', {
      p_conversation_id: 'conv-1',
    });
    // The table path is the bug this replaced; it must not come back.
    expect(builder.update).not.toHaveBeenCalled();
  });
});
