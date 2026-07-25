// ABOUTME: Regression tests for useConversationMessages.
// ABOUTME: Fetch failures must toast; mark-as-read failures are telemetry and must warn without breaking the loaded messages.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversationMessages } from '../useConversationMessages';
import {
  supabaseError,
  getQueryBuilder,
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
      )
      // 2nd await: mark-as-read update fails
      .mockImplementationOnce((resolve: (value: unknown) => void) =>
        resolve(supabaseError('mark read failed'))
      );

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
});
