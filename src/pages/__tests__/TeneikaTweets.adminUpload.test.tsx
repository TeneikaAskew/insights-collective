// ABOUTME: Pins the admin gate on the archive-import control. The button writes
// ABOUTME: two publicly-rendered tables, so a non-admin must never see it — and
// ABOUTME: hiding it is only half the story, which is why the Edge Function
// ABOUTME: re-checks with requireAdmin.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import TeneikaTweets from '@/pages/TeneikaTweets';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const authState = vi.hoisted(() => ({
  user: { id: 'admin-1' } as { id: string } | null,
  isAuthenticated: true,
  isAdmin: false,
}));
// Spread the real module: the shared render wrapper mounts <AuthProvider>, so
// replacing the whole module leaves it undefined and the provider tree dies
// before the thing under test runs.
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/AuthContext')>();
  return { ...actual, useAuth: () => authState };
});

// The page's own query. Returning an empty list keeps this focused on the gate.
vi.mock('@/integrations/supabase/client', () => {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return {
    supabase: {
      from: vi.fn(() => query),
      functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    },
  };
});

describe('TeneikaTweets archive import control', () => {
  beforeEach(() => {
    authState.isAdmin = false;
    authState.user = { id: 'admin-1' };
  });

  it('hides the import control from a signed-in non-admin', async () => {
    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByText("Teneika's Tweets")).toBeInTheDocument();
    });
    expect(screen.queryByTestId('import-archive-button')).not.toBeInTheDocument();
  });

  it('hides it from a signed-out visitor', async () => {
    authState.user = null;

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByText("Teneika's Tweets")).toBeInTheDocument();
    });
    expect(screen.queryByTestId('import-archive-button')).not.toBeInTheDocument();
  });

  it('shows it to an admin', async () => {
    authState.isAdmin = true;

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByTestId('import-archive-button')).toBeInTheDocument();
    });
  });

  // The old "Refresh Tweets" button invoked scrape-teneika-tweets, which sits
  // behind requireAdminOrService — so for a signed-out or non-admin visitor it was
  // a visible control that could only ever return 401 and raise a failure toast.
  it('no longer offers a scrape button to anyone', async () => {
    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByText("Teneika's Tweets")).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /refresh tweets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /scrape/i })).not.toBeInTheDocument();
  });

  it('does not offer a scrape button to an admin either', async () => {
    authState.isAdmin = true;

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByTestId('import-archive-button')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /refresh tweets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /scrape/i })).not.toBeInTheDocument();
  });

  // The empty state used to offer "Scrape Tweets" to everyone. An admin now gets
  // the import that actually works; a visitor gets no dead control at all.
  it('offers the archive import from the empty state, admins only', async () => {
    authState.isAdmin = true;

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /import from x archive/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows a non-admin an empty state with no action', async () => {
    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByText(/no tweets have been imported yet/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /import from x archive/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the upload dialog when an admin clicks it', async () => {
    authState.isAdmin = true;
    const user = userEvent.setup();

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(screen.getByTestId('import-archive-button')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('import-archive-button'));

    await waitFor(() => {
      expect(screen.getByTestId('tweet-archive-upload-dialog')).toBeInTheDocument();
    });
    // The dropzone is the point of the dialog; assert it rather than just the shell.
    expect(screen.getByTestId('archive-dropzone')).toBeInTheDocument();
  });

  it('gives the control an accessible name rather than a bare icon', async () => {
    authState.isAdmin = true;

    render(<TeneikaTweets />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /import tweets from x archive/i }),
      ).toBeInTheDocument();
    });
  });
});
