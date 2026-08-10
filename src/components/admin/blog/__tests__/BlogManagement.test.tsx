// ABOUTME: Tests for the Manage Blog list — the capabilities restored from the
// ABOUTME: retired V1 surface (sorting, Featured filter, tags on rows) and the
// ABOUTME: role scoping that keeps instructors to their own posts.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { BlogManagement } from '@/components/admin/blog/BlogManagement';
import { useAuth } from '@/contexts/AuthContext';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

// The other tabs do their own querying; stub them so this file tests the list.
vi.mock('@/components/blog/categories/BlogCategoriesManager', () => ({
  BlogCategoriesManager: () => <div data-testid="categories-manager" />,
}));
vi.mock('@/components/blog/analytics/BlogAnalyticsDashboard', () => ({
  BlogAnalyticsDashboard: () => <div data-testid="analytics-dashboard" />,
}));
vi.mock('@/components/admin/blog/BlogSettings', () => ({
  BlogSettings: () => <div data-testid="blog-settings" />,
}));

function builder(result: { data: any; error: any }) {
  const b: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
    b[m] = vi.fn(() => b);
  }
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (ok: any, err: any) => Promise.resolve(result).then(ok, err);
  return b;
}

const posts = [
  {
    id: 'p1', title: 'Alpha post', slug: 'alpha', content: '', excerpt: 'first',
    status: 'published', author_id: 'author-1', category_id: null,
    view_count: 10, likes_count: 0, read_time: 3, featured: false,
    scheduled_at: null, published_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2', title: 'Beta post', slug: 'beta', content: '', excerpt: 'second',
    status: 'published', author_id: 'author-2', category_id: null,
    view_count: 99, likes_count: 0, read_time: 2, featured: true,
    scheduled_at: null, published_at: '2026-02-01T00:00:00Z',
    created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
  },
];

const tags = [
  { blog_post_id: 'p1', tag_name: 'ai' },
  { blog_post_id: 'p1', tag_name: 'data' },
  { blog_post_id: 'p1', tag_name: 'extra' },
];

let postsBuilder: any;

function wire(rows = posts) {
  postsBuilder = builder({ data: rows, error: null });
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    if (table === 'blog_posts') return postsBuilder;
    if (table === 'blog_categories') return builder({ data: [], error: null });
    if (table === 'profiles') return builder({ data: [], error: null });
    if (table === 'blog_post_tags') return builder({ data: tags, error: null });
    return builder({ data: [], error: null });
  });
}

function signedInAs(roles: string[], id = 'author-1') {
  vi.mocked(useAuth).mockReturnValue({
    user: { id, roles },
    session: null,
    isAuthenticated: true,
    loading: false,
    error: null,
    isAdmin: roles.includes('admin'),
    isAdminAuthenticated: roles.includes('admin'),
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    googleSignIn: vi.fn(), githubSignIn: vi.fn(), twitterSignIn: vi.fn(),
  } as any);
}

describe('BlogManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockSupabaseClient.from as any).mockReset();
  });

  describe('capabilities restored from the retired V1 list', () => {
    it('renders tags on rows, capped at two with an overflow badge', async () => {
      signedInAs(['admin']);
      wire();

      render(<BlogManagement />);

      expect(await screen.findByText('Alpha post')).toBeInTheDocument();
      expect(screen.getByText('ai')).toBeInTheDocument();
      expect(screen.getByText('data')).toBeInTheDocument();
      // Third tag collapses into "+1" rather than being dropped silently.
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.queryByText('extra')).not.toBeInTheDocument();
    });

    // The Featured filter option is exercised in the Playwright suite
    // (e2e/admin/blog-management.spec.ts) rather than here: opening a Radix
    // Select requires pointer-event behavior jsdom does not implement, so a
    // unit test for it would be flaky rather than informative.

    it('marks a featured post so it is distinguishable in the list', async () => {
      signedInAs(['admin']);
      wire();

      render(<BlogManagement />);

      await screen.findByText('Beta post');
      // Beta is the featured fixture; the badge is what the Featured filter
      // narrows to.
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('sorts by title when the Title control is used', async () => {
      const user = userEvent.setup();
      signedInAs(['admin']);
      wire();

      // Only the post titles, in DOM order — the stat cards are headings too.
      const postOrder = () =>
        screen
          .getAllByRole('heading', { level: 3 })
          .map(h => h.textContent)
          .filter(t => t === 'Alpha post' || t === 'Beta post');

      render(<BlogManagement />);
      await screen.findByText('Alpha post');

      // Default sort is newest-first, so Beta (Feb) precedes Alpha (Jan).
      expect(postOrder()).toEqual(['Beta post', 'Alpha post']);

      await user.click(screen.getByRole('button', { name: /Title/ }));

      // Title sort ascends, flipping the order — proving the control works
      // rather than coincidentally matching the initial render.
      await waitFor(() => {
        expect(postOrder()).toEqual(['Alpha post', 'Beta post']);
      });
    });
  });

  describe('role scoping', () => {
    it('an instructor only queries their own posts', async () => {
      signedInAs(['instructor'], 'author-1');
      wire();

      render(<BlogManagement />);

      await waitFor(() => {
        expect(postsBuilder.eq).toHaveBeenCalledWith('author_id', 'author-1');
      });
    });

    it('an admin is not restricted to their own posts', async () => {
      signedInAs(['admin'], 'admin-1');
      wire();

      render(<BlogManagement />);

      await screen.findByText('Alpha post');
      expect(postsBuilder.eq).not.toHaveBeenCalledWith('author_id', 'admin-1');
    });

    it('hides Categories and Settings from an instructor — RLS would reject those writes', async () => {
      signedInAs(['instructor'], 'author-1');
      wire();

      render(<BlogManagement />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Posts/ })).toBeInTheDocument();
      });

      expect(screen.queryByRole('tab', { name: /Categories/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Settings/ })).not.toBeInTheDocument();
      // Analytics is readable for an instructor's own posts, so it stays.
      expect(screen.getByRole('tab', { name: /Analytics/ })).toBeInTheDocument();
    });

    it('shows Categories and Settings to an admin', async () => {
      signedInAs(['admin']);
      wire();

      render(<BlogManagement />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Categories/ })).toBeInTheDocument();
      });
      expect(screen.getByRole('tab', { name: /Settings/ })).toBeInTheDocument();
    });
  });
});
