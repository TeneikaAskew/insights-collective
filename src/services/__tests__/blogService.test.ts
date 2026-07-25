// ABOUTME: Regression tests for blogService silent-failure fixes.
// ABOUTME: Verifies query/write errors are thrown instead of returning []/null/false/zeroed defaults.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getBlogCategories,
  getBlogPostAnalytics,
  recordBlogPostView,
} from '../blogService';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';

// Standalone chainable builder resolving to `result` whether the chain ends in
// .single()/.maybeSingle() or is awaited directly (via .then).
function createBuilder(result: { data: any; error: any } = { data: null, error: null }) {
  const builder: any = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'not', 'in', 'is', 'or', 'order', 'limit', 'gte', 'lte', 'lt', 'gt',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  );
  return builder;
}

function mockTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    const builder = tables[table];
    if (!builder) {
      throw new Error(`Unexpected query to table "${table}" in this test`);
    }
    return builder;
  });
}

const post = {
  id: 'post-1',
  title: 'Hello',
  content: 'Body text',
  excerpt: 'Short',
  slug: 'hello',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  author_id: 'author-1',
  image_url: null,
  status: 'published',
  featured: false,
  seo_title: null,
  seo_description: null,
  view_count: 3,
  read_time: 1,
  category_id: null,
  blog_categories: { name: 'News' },
  blog_post_tags: [{ tag_name: 'ai' }],
  profiles: { first_name: 'Ada', last_name: 'Lovelace' },
};

describe('blogService error propagation', () => {
  beforeEach(() => {
    (mockSupabaseClient.from as any).mockReset();
    (mockSupabaseClient.rpc as any).mockReset().mockResolvedValue({ data: null, error: null });
    (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'author-1' } },
      error: null,
    });
  });

  describe('getAllBlogPosts', () => {
    it('returns mapped posts on success', async () => {
      mockTables({
        blog_posts: createBuilder({ data: [post], error: null }),
        profiles: createBuilder({
          data: [{ id: 'author-1', first_name: 'Ada', last_name: 'Lovelace' }],
          error: null,
        }),
      });

      const result = await getAllBlogPosts();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'post-1',
        title: 'Hello',
        authorName: 'Ada Lovelace',
        category: 'News',
        tags: ['ai'],
      });
    });

    it('throws on query error instead of returning an empty list', async () => {
      mockTables({ blog_posts: createBuilder(supabaseError('boom')) });

      await expect(getAllBlogPosts()).rejects.toMatchObject({ message: 'boom' });
    });

    it('throws when the author lookup fails instead of silently mislabeling authors', async () => {
      mockTables({
        blog_posts: createBuilder({ data: [post], error: null }),
        profiles: createBuilder(supabaseError('authors failed')),
      });

      await expect(getAllBlogPosts()).rejects.toMatchObject({ message: 'authors failed' });
    });
  });

  describe('getBlogPostBySlug', () => {
    it('throws on query error instead of returning null', async () => {
      mockTables({ blog_posts: createBuilder(supabaseError('post fetch failed')) });

      await expect(getBlogPostBySlug('hello')).rejects.toMatchObject({
        message: 'post fetch failed',
      });
    });

    it('still returns null for a genuinely missing post', async () => {
      mockTables({ blog_posts: createBuilder({ data: null, error: null }) });

      await expect(getBlogPostBySlug('missing')).resolves.toBeNull();
    });

    it('throws when the tags lookup fails instead of silently dropping tags', async () => {
      mockTables({
        blog_posts: createBuilder({ data: { ...post, category_id: null, author_id: null }, error: null }),
        blog_post_tags: createBuilder(supabaseError('tags failed')),
      });

      await expect(getBlogPostBySlug('hello')).rejects.toMatchObject({ message: 'tags failed' });
    });
  });

  describe('createBlogPost', () => {
    it('throws on insert error instead of returning null', async () => {
      mockTables({ blog_posts: createBuilder(supabaseError('insert failed')) });

      await expect(
        createBlogPost({ title: 'T', content: 'C', excerpt: 'E', slug: 's' } as any)
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    it('throws when the tag insert fails so success is gated on the whole write', async () => {
      mockTables({
        blog_posts: createBuilder({ data: post, error: null }),
        blog_post_tags: createBuilder(supabaseError('tag insert failed')),
        profiles: createBuilder({ data: { first_name: 'Ada', last_name: 'L' }, error: null }),
      });

      await expect(
        createBlogPost({ title: 'T', content: 'C', excerpt: 'E', slug: 's', tags: ['ai'] } as any)
      ).rejects.toMatchObject({ message: 'tag insert failed' });
    });
  });

  describe('updateBlogPost', () => {
    it('throws on update error instead of returning null', async () => {
      const blogPosts = createBuilder({ data: { id: 'post-1', author_id: 'author-1', status: 'draft' }, error: null });
      // First .single() resolves the existing-post fetch; second one is the update.
      blogPosts.single
        .mockResolvedValueOnce({ data: { id: 'post-1', author_id: 'author-1', status: 'draft' }, error: null })
        .mockResolvedValueOnce(supabaseError('update failed'));
      mockTables({ blog_posts: blogPosts });

      await expect(
        updateBlogPost('hello', { title: 'T', content: 'C', excerpt: 'E', slug: 'hello' } as any)
      ).rejects.toMatchObject({ message: 'update failed' });
    });

    it('throws when replacing tags fails instead of silently keeping stale tags', async () => {
      const blogPosts = createBuilder({ data: post, error: null });
      blogPosts.single
        .mockResolvedValueOnce({ data: { id: 'post-1', author_id: 'author-1', status: 'draft' }, error: null })
        .mockResolvedValueOnce({ data: post, error: null });
      mockTables({
        blog_posts: blogPosts,
        blog_post_tags: createBuilder(supabaseError('tag delete failed')),
      });

      await expect(
        updateBlogPost('hello', { title: 'T', content: 'C', excerpt: 'E', slug: 'hello' } as any)
      ).rejects.toMatchObject({ message: 'tag delete failed' });
    });
  });

  describe('deleteBlogPost', () => {
    it('returns true on success', async () => {
      mockTables({ blog_posts: createBuilder({ data: null, error: null }) });

      await expect(deleteBlogPost('hello')).resolves.toBe(true);
    });

    it('throws on delete error instead of returning false', async () => {
      mockTables({ blog_posts: createBuilder(supabaseError('delete failed')) });

      await expect(deleteBlogPost('hello')).rejects.toMatchObject({ message: 'delete failed' });
    });
  });

  describe('getBlogCategories', () => {
    it('throws on query error instead of returning an empty list', async () => {
      mockTables({ blog_categories: createBuilder(supabaseError('categories failed')) });

      await expect(getBlogCategories()).rejects.toMatchObject({ message: 'categories failed' });
    });
  });

  describe('getBlogPostAnalytics', () => {
    it('throws on query error instead of returning zeroed metrics', async () => {
      mockTables({ blog_post_views: createBuilder(supabaseError('analytics failed')) });

      await expect(getBlogPostAnalytics('hello', '7d')).rejects.toMatchObject({
        message: 'analytics failed',
      });
    });

    it('computes metrics from returned rows on success', async () => {
      mockTables({
        blog_post_views: createBuilder({
          data: [
            { visitor_id: 'v1', view_duration: 10 },
            { visitor_id: 'v1', view_duration: 30 },
          ],
          error: null,
        }),
      });

      const analytics = await getBlogPostAnalytics('hello', '7d');
      expect(analytics.views).toBe(2);
      expect(analytics.uniqueVisitors).toBe(1);
      expect(analytics.averageTimeOnPage).toBe(20);
    });
  });

  describe('recordBlogPostView (telemetry)', () => {
    it('never throws even when the insert and the view-count RPC fail', async () => {
      mockTables({ blog_post_views: createBuilder(supabaseError('view insert failed')) });
      (mockSupabaseClient.rpc as any).mockResolvedValue(supabaseError('missing rpc'));

      await expect(recordBlogPostView('post-1', 'hello')).resolves.toBeUndefined();
    });
  });
});
