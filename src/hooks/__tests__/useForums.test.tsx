// ABOUTME: Unit tests for the forum hooks in useForums.ts.
// ABOUTME: Includes regressions proving query errors throw instead of falling back to mock forum data.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useForums,
  useForumThreads,
  useThreadPosts,
  useThreadSubscription,
  useCreatePost,
  useMarkThreadAsRead,
} from '../useForums';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';

// Local wrapper factory (instead of createHookWrapper) so tests can inspect
// query state (status === 'error') — the hooks don't expose isError directly.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

// Resolve the awaited query-builder chain (`await supabase.from()...order()`)
// with the given payload. The mock builder is thenable, so stubbing `then`
// covers chains that end in any builder method.
function resolveQuery(payload: unknown) {
  const builder = getQueryBuilder();
  builder.then.mockImplementation((resolve: (value: unknown) => void) =>
    resolve(payload)
  );
  return builder;
}

// Strings that only ever appeared in the removed hardcoded mock data.
const MOCK_DATA_MARKERS = [
  'General Discussion',
  'Technical Questions',
  'Welcome to the Forum',
  'How to ask good questions',
  'John',
  'Doe',
  'Jane',
  'Smith',
  'Welcome to the discussion',
];

function expectNoMockContent(value: unknown) {
  const serialized = JSON.stringify(value) ?? '';
  for (const marker of MOCK_DATA_MARKERS) {
    expect(serialized).not.toContain(marker);
  }
}

describe('useForums', () => {
  it('returns forums from the database on success', async () => {
    const forumRows = [
      {
        id: 'forum-1',
        title: 'Analytics Q&A',
        description: 'Course questions',
        course_id: 'course-1',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'forum-2',
        title: 'Project feedback',
        description: 'Share your work',
        course_id: 'course-1',
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    resolveQuery({ data: forumRows, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useForums('course-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoadingForums).toBe(false));

    expect(result.current.forums).toEqual(forumRows);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('forums');
  });

  it('surfaces query errors and does NOT fall back to mock forums (regression)', async () => {
    resolveQuery(supabaseError('forums query failed'));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useForums('course-1'), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(['forums', 'course-1'])?.status).toBe(
        'error'
      )
    );

    expect(result.current.forums).toBeUndefined();
    expectNoMockContent(result.current);
  });

  it('returns an empty array for an empty database, not mock forums', async () => {
    resolveQuery({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useForums('course-1'), { wrapper });

    await waitFor(() => expect(result.current.forums).toEqual([]));
    expectNoMockContent(result.current);
  });

  it('does not query when courseId is missing', async () => {
    // from.mock.calls accumulates across tests in this file; start clean.
    vi.mocked(mockSupabaseClient.from).mockClear();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useForums(''), { wrapper });

    expect(result.current.forums).toBeUndefined();
    const forumCalls = (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]) => table === 'forums'
    );
    expect(forumCalls).toHaveLength(0);
  });
});

describe('useForumThreads', () => {
  it('returns threads from the database on success', async () => {
    const threadRows = [
      {
        id: 'thread-1',
        title: 'Assignment 2 clarification',
        user_id: 'user-9',
        forum_id: 'forum-1',
        is_pinned: false,
        is_locked: false,
        author: { first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
        post_count: [{ count: 4 }],
      },
    ];
    resolveQuery({ data: threadRows, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useForumThreads('forum-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoadingThreads).toBe(false));

    expect(result.current.threads).toEqual(threadRows);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('threads');
  });

  it('surfaces query errors and does NOT fall back to mock threads (regression)', async () => {
    resolveQuery(supabaseError('threads query failed'));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useForumThreads('forum-1'), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(['threads', 'forum-1'])?.status).toBe(
        'error'
      )
    );

    expect(result.current.threads).toBeUndefined();
    expectNoMockContent(result.current);
  });

  it('returns an empty array for a forum with no threads, not mock threads', async () => {
    resolveQuery({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useForumThreads('forum-1'), { wrapper });

    await waitFor(() => expect(result.current.threads).toEqual([]));
    expectNoMockContent(result.current);
  });
});

describe('useThreadPosts', () => {
  it('returns posts from the database on success', async () => {
    const postRows = [
      {
        id: 'post-1',
        thread_id: 'thread-1',
        user_id: 'user-9',
        content: '<p>Here is my take on the exercise.</p>',
        parent_id: null,
        author: { first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
      },
    ];
    resolveQuery({ data: postRows, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useThreadPosts('thread-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoadingPosts).toBe(false));

    expect(result.current.posts).toEqual(postRows);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('posts');
  });

  it('surfaces query errors and does NOT fall back to mock posts (regression)', async () => {
    resolveQuery(supabaseError('posts query failed'));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useThreadPosts('thread-1'), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(['posts', 'thread-1'])?.status).toBe(
        'error'
      )
    );

    expect(result.current.posts).toBeUndefined();
    expectNoMockContent(result.current);
  });

  it('returns an empty array for a thread with no posts, not mock posts', async () => {
    resolveQuery({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useThreadPosts('thread-1'), { wrapper });

    await waitFor(() => expect(result.current.posts).toEqual([]));
    expectNoMockContent(result.current);
  });
});

describe('useThreadSubscription', () => {
  it('reports subscribed when a subscription row exists', async () => {
    const subscriptionRow = {
      id: 'sub-1',
      thread_id: 'thread-1',
      forum_id: null,
      user_id: 'user-1',
    };
    resolveQuery({ data: [subscriptionRow], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useThreadSubscription('thread-1', null, 'user-1'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(result.current.subscription).toEqual(subscriptionRow);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('thread_subscriptions');
  });

  it('reports not subscribed when no subscription row exists', async () => {
    resolveQuery({ data: [], error: null });

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () => useThreadSubscription('thread-1', null, 'user-1'),
      { wrapper }
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(['subscription', 'thread-1', null, 'user-1'])
          ?.status
      ).toBe('success')
    );

    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.subscription).toBeNull();
  });

  it('surfaces query errors instead of silently returning null (regression)', async () => {
    resolveQuery(supabaseError('subscription query failed'));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () => useThreadSubscription('thread-1', null, 'user-1'),
      { wrapper }
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(['subscription', 'thread-1', null, 'user-1'])
          ?.status
      ).toBe('error')
    );

    expect(result.current.subscription).toBeUndefined();
    expect(result.current.isSubscribed).toBe(false);
  });
});

describe('useCreatePost', () => {
  it('inserts the post and bumps the thread timestamp on success', async () => {
    const builder = getQueryBuilder();
    const post = { id: 'post-1', thread_id: 'thread-1', content: 'hi' };
    // posts insert chain terminates in .single(); the follow-up threads
    // update chain is awaited directly (thenable builder).
    builder.single.mockResolvedValueOnce({ data: post, error: null });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: null, error: null })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePost('thread-1'), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({
        content: 'hi',
        userId: 'user-1',
        parentId: null,
      });
    });

    expect(created).toEqual(post);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('posts');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('threads');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(String) })
    );
  });

  it('REGRESSION: rejects with a partial-failure error when the thread-timestamp update fails', async () => {
    const builder = getQueryBuilder();
    builder.single.mockResolvedValueOnce({
      data: { id: 'post-1' },
      error: null,
    });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve(supabaseError('threads update failed'))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePost('thread-1'), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          content: 'hi',
          userId: 'user-1',
          parentId: null,
        })
      ).rejects.toThrow(
        'Reply was posted, but updating the thread timestamp failed: threads update failed'
      );
    });
  });
});

describe('useMarkThreadAsRead', () => {
  it('creates a read-status entry when none exists', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [{ id: 'rs-1' }], error: null })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkThreadAsRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ threadId: 'thread-1', userId: 'user-1' });
    });

    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ thread_id: 'thread-1', user_id: 'user-1' }),
    ]);
  });

  it('REGRESSION: rejects when the existence probe fails and performs NO write', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValueOnce(
      supabaseError('read-status probe failed')
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkThreadAsRead(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ threadId: 'thread-1', userId: 'user-1' })
      ).rejects.toMatchObject({ message: 'read-status probe failed' });
    });

    // A probe failure must not be treated as "no entry" → insert
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.update).not.toHaveBeenCalled();
  });
});
