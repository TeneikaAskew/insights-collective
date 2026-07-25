// ABOUTME: Regression tests for the public Blog page — a failed load must render
// ABOUTME: a distinct error state with retry, never the "No articles" empty state.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import Blog from '@/pages/Blog';
import { getAllBlogPosts, getBlogCategories } from '@/services/blogService';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/blogService', () => ({
  getAllBlogPosts: vi.fn(),
  getBlogCategories: vi.fn(),
}));

describe('Blog page', () => {
  beforeEach(() => {
    vi.mocked(getAllBlogPosts).mockReset();
    vi.mocked(getBlogCategories).mockReset();
  });

  it('renders a distinct error state with retry when the load fails', async () => {
    vi.mocked(getAllBlogPosts).mockRejectedValue(new Error('connection refused'));
    vi.mocked(getBlogCategories).mockRejectedValue(new Error('connection refused'));

    render(<Blog />);

    expect(await screen.findByText('Failed to load blog articles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // REGRESSION: failure used to fall through to the empty state.
    expect(screen.queryByText(/No articles found/i)).not.toBeInTheDocument();
  });

  it('retry re-runs the load and recovers', async () => {
    vi.mocked(getAllBlogPosts)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    vi.mocked(getBlogCategories)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);

    render(<Blog />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText(/No articles found/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Failed to load blog articles')).not.toBeInTheDocument();
  });

  it('still renders the genuine empty state when there are no posts', async () => {
    vi.mocked(getAllBlogPosts).mockResolvedValue([]);
    vi.mocked(getBlogCategories).mockResolvedValue([]);

    render(<Blog />);

    expect(await screen.findByText(/No articles found/i)).toBeInTheDocument();
    expect(screen.queryByText('Failed to load blog articles')).not.toBeInTheDocument();
  });
});
