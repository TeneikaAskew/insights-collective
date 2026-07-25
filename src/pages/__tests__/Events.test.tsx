// ABOUTME: Regression tests for the Events page — a failed load must render an
// ABOUTME: error state with retry, never the "no upcoming events" message.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import Events from '@/pages/Events';
import { useEventsWithRegistrations } from '@/hooks/useEventsWithRegistrations';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useEventsWithRegistrations', () => ({
  useEventsWithRegistrations: vi.fn(),
}));

describe('Events page', () => {
  beforeEach(() => {
    vi.mocked(useEventsWithRegistrations).mockReset();
  });

  it('renders an error state with retry when the load fails', async () => {
    vi.mocked(useEventsWithRegistrations).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fetch failed'),
      refetch: vi.fn(),
    } as any);

    render(<Events />);

    expect(await screen.findByText('Failed to load events')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // REGRESSION: an outage used to render as "no upcoming events".
    expect(screen.queryByText(/no upcoming events/i)).not.toBeInTheDocument();
  });

  it('renders the genuine empty state when there are no events', async () => {
    vi.mocked(useEventsWithRegistrations).mockReturnValue({
      data: { events: [], registeredEventIds: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<Events />);

    expect(screen.queryByText('Failed to load events')).not.toBeInTheDocument();
    // The empty-state component renders its usual copy.
    expect(await screen.findByText(/Upcoming Events \(0\)/)).toBeInTheDocument();
  });
});
