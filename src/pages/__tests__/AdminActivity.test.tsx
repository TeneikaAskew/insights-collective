// ABOUTME: Regression tests for AdminActivity — a failed security_events fetch
// ABOUTME: must render an error state with retry, never "No activities found".

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import AdminActivity from '@/pages/AdminActivity';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockActivityQuery(results: Array<{ data?: any; error?: any }>) {
  let call = 0;
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const result = results[Math.min(call, results.length - 1)];
    call += 1;
    const builder: any = {};
    for (const m of ['select', 'order', 'limit', 'eq']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(
        onFulfilled,
        onRejected
      );
    return builder;
  });
}

describe('AdminActivity', () => {
  it('shows an error state with retry on a failed fetch, not "No activities found"', async () => {
    mockActivityQuery([{ error: { message: 'permission denied' } }]);

    render(<AdminActivity />);

    expect(await screen.findByText('Failed to load activity log')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('No activities found')).not.toBeInTheDocument();
  });

  it('retry re-fetches and renders the recovered rows', async () => {
    mockActivityQuery([
      { error: { message: 'boom' } },
      {
        data: [
          {
            id: 'e1',
            user_id: 'u1',
            event_type: 'login_failed',
            severity: 'warning',
            description: 'Failed login attempt',
            created_at: new Date().toISOString(),
          },
        ],
      },
    ]);

    render(<AdminActivity />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed login attempt')).toBeInTheDocument();
    });
    expect(screen.queryByText('Failed to load activity log')).not.toBeInTheDocument();
  });

  it('renders the genuine empty state when there are no events', async () => {
    mockActivityQuery([{ data: [] }]);

    render(<AdminActivity />);

    expect(await screen.findByText('No activities found')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load activity log')).not.toBeInTheDocument();
  });
});
