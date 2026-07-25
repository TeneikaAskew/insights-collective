// ABOUTME: Regression tests for the BlogPost page — a fetch failure must render
// ABOUTME: an error state with retry, distinct from the genuine "not found" page.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import BlogPostPage from '@/pages/BlogPost';
import { getBlogPostBySlug } from '@/services/blogService';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/blogService', () => ({
  getBlogPostBySlug: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ slug: 'my-post' }),
  };
});

describe('BlogPost page', () => {
  beforeEach(() => {
    vi.mocked(getBlogPostBySlug).mockReset();
  });

  it('shows an error state (not "not found") when the fetch fails', async () => {
    vi.mocked(getBlogPostBySlug).mockRejectedValue(new Error('network down'));

    render(<BlogPostPage />);

    expect(await screen.findByText('Failed to load blog post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // REGRESSION: errors used to masquerade as "Blog post not found".
    expect(screen.queryByText('Blog post not found')).not.toBeInTheDocument();
  });

  it('still shows "not found" for a genuinely missing post', async () => {
    vi.mocked(getBlogPostBySlug).mockResolvedValue(null);

    render(<BlogPostPage />);

    expect(await screen.findByText('Blog post not found')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load blog post')).not.toBeInTheDocument();
  });
});
