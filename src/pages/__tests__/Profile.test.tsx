// ABOUTME: Regression tests for the Profile page — a failed profile load must
// ABOUTME: block the edit form (saving blanks would overwrite the real profile).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import Profile from '@/pages/Profile';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockProfileQuery(result: { data?: any; error?: any }) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    // Only the profiles table returns the configured result — everything else
    // (e.g. certificates rendered by MyCertificates) resolves to empty lists.
    const tableResult =
      table === 'profiles'
        ? { data: result.data ?? null, error: result.error ?? null }
        : { data: [], error: null };
    const builder: any = {};
    for (const m of ['select', 'eq', 'update', 'order', 'limit', 'in']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn().mockResolvedValue(tableResult);
    builder.maybeSingle = builder.single;
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(tableResult).then(onFulfilled, onRejected);
    return builder;
  });
}

describe('Profile page', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'user-1', email: 'a@b.c', name: 'Ada' },
        isAuthenticated: true,
        loading: false,
      }) as any
    );
  });

  it('blocks the form with an error state when the profile load fails', async () => {
    mockProfileQuery({ error: { message: 'RLS denied' } });

    render(<Profile />);

    expect(await screen.findByText('Failed to load your profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // REGRESSION: the page used to render a blank editable form after a
    // failed load — saving it overwrote the user's real name with blanks.
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  it('renders the populated form when the profile loads', async () => {
    mockProfileQuery({
      data: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
    });

    render(<Profile />);

    expect(await screen.findByDisplayValue('Ada')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load your profile')).not.toBeInTheDocument();
  });
});
