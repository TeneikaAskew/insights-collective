// ABOUTME: Regression tests for useAssistantChat silent-failure fixes.
// ABOUTME: A failed assistant call must never inject a fabricated assistant reply into the chat.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantChat } from '../useAssistantChat';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const { mockToast, mockNavigate } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const assistant = {
  id: 'career-explorer',
  name: 'Career Explorer',
  description: 'Explore careers.',
} as any;

const settings = {
  careerFocus: 'Data',
  careerPath: 'Analytics',
  salaryCap: 100000,
} as any;

describe('useAssistantChat.handleSendMessage', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.functions.invoke as any).mockReset();
    (localStorage.getItem as any).mockReturnValue(null);
  });

  it('adds the real assistant response on success', async () => {
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: { response: 'Here is real advice.' },
      error: null,
    });

    const { result } = renderHook(() => useAssistantChat(assistant));

    act(() => result.current.setInputValue('Hi'));
    await act(async () => {
      await result.current.handleSendMessage(settings);
    });

    const assistantMessages = result.current.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].content).toBe('Here is real advice.');
  });

  it('does not fabricate an assistant reply when the edge function errors', async () => {
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: null,
      error: { message: 'edge function down' },
    });

    const { result } = renderHook(() => useAssistantChat(assistant));

    act(() => result.current.setInputValue('Hi'));
    await act(async () => {
      await result.current.handleSendMessage(settings);
    });

    // The user's message stays, but NO fake assistant response is added.
    expect(result.current.messages.filter(m => m.role === 'assistant')).toHaveLength(0);
    expect(result.current.messages.filter(m => m.role === 'user')).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('treats an empty payload as a failure instead of showing a canned apology', async () => {
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: {},
      error: null,
    });

    const { result } = renderHook(() => useAssistantChat(assistant));

    act(() => result.current.setInputValue('Hi'));
    await act(async () => {
      await result.current.handleSendMessage(settings);
    });

    expect(result.current.messages.filter(m => m.role === 'assistant')).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });
});

describe('useAssistantChat.fetchConversationHistory', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.functions.invoke as any).mockReset();
  });

  it('toasts when the stored conversation history cannot be loaded', async () => {
    (localStorage.getItem as any).mockImplementation((key: string) => {
      if (key === 'activeConversationId') return 'conv-1';
      return null;
    });

    const { getQueryBuilder } = await import('@/test/mocks/supabase');
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: null, error: { message: 'history failed' } })
    );

    renderHook(() => useAssistantChat(assistant));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });
});
