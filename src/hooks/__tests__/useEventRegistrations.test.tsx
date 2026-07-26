// ABOUTME: Regression tests for useEventRegistrations silent-failure fixes.
// ABOUTME: Covers ghost-column removal in the profiles embed and error propagation in useIsRegisteredForEvent.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useEventRegistrations,
  useIsRegisteredForEvent,
} from '../useEventRegistrations';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { useAuth } from '@/hooks/useAuth';

// A real uuid: the hook only queries for well-formed ids, so a placeholder
// like 'event-1' would exercise the guard instead of the query.
const EVENT_ID = 'dd0e8400-e29b-41d4-a716-446655440001';

describe('useEventRegistrations', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
  });

  it('selects real profile columns (first_name/last_name), not the ghost full_name/email columns', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null })
    );

    const { result } = renderHook(() => useEventRegistrations(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const selectArg = builder.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('first_name');
    expect(selectArg).toContain('last_name');
    expect(selectArg).not.toContain('full_name');
    expect(selectArg).not.toContain('email');
  });

  it('surfaces query errors instead of returning an empty list', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve(supabaseError('registrations failed'))
    );

    const { result } = renderHook(() => useEventRegistrations(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useIsRegisteredForEvent', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
  });

  it('errors instead of silently reporting "not registered" when the query fails', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue(supabaseError('lookup failed'));

    const { result } = renderHook(() => useIsRegisteredForEvent(EVENT_ID), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Crucially, data must NOT be a default `false` masking the failure.
    expect(result.current.data).toBeUndefined();
  });

  it('returns true when a registration row exists', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: { id: 'reg-1' }, error: null });

    const { result } = renderHook(() => useIsRegisteredForEvent(EVENT_ID), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBe(true));
  });

  it('does not query at all for an id that is not a uuid', async () => {
    // A typo or a stale link used to reach Postgres and come back as 22P02,
    // logged as an application error.
    mockSupabaseClient.from.mockClear();
    const { result } = renderHook(() => useIsRegisteredForEvent('test-event-id'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('returns false when no registration row exists (genuine empty)', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useIsRegisteredForEvent(EVENT_ID), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
  });
});
