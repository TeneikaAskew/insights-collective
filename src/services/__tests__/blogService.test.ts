import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as blogService from '../blogService';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

describe('blogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBlogPosts', () => {
    it('should fetch published blog posts', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'First Post',
          slug: 'first-post',
          content: 'Content here',
          excerpt: 'Excerpt here',
          status: 'published',
          published_at: '2024-01-01',
        },
        {
          id: '2',
          title: 'Second Post',
          slug: 'second-post',
          content: 'More content',
          excerpt: 'Another excerpt',
          status: 'published',
          published_at: '2024-01-02',
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
      });

      const result = await blogService.getBlogPosts();

      expect(result).toEqual(mockPosts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('status', 'published');
    });

    it('should handle fetch error', async () => {
      const error = new Error('Failed to fetch posts');
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error }),
      });

      await expect(blogService.getBlogPosts()).rejects.toThrow('Failed to fetch posts');
    });
  });

  describe('getBlogPostBySlug', () => {
    it('should fetch a single blog post by slug', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Test content',
        author_profiles: {
          full_name: 'John Doe',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
      });

      const result = await blogService.getBlogPostBySlug('test-post');

      expect(result).toEqual(mockPost);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('slug', 'test-post');
    });

    it('should return null for non-existent post', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await blogService.getBlogPostBySlug('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createBlogPost', () => {
    it('should create a new blog post', async () => {
      const newPost = {
        title: 'New Post',
        slug: 'new-post',
        content: 'New content',
        excerpt: 'New excerpt',
        author_id: 'user123',
      };

      const createdPost = { id: '123', ...newPost };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdPost, error: null }),
      });

      const result = await blogService.createBlogPost(newPost);

      expect(result).toEqual(createdPost);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([newPost]);
    });

    it('should handle creation error', async () => {
      const error = new Error('Failed to create post');
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error }),
      });

      await expect(blogService.createBlogPost({} as any)).rejects.toThrow('Failed to create post');
    });
  });

  describe('updateBlogPost', () => {
    it('should update an existing blog post', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updatedPost = { id: '123', ...updates };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedPost, error: null }),
      });

      const result = await blogService.updateBlogPost('123', updates);

      expect(result).toEqual(updatedPost);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(updates);
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', '123');
    });
  });

  describe('deleteBlogPost', () => {
    it('should delete a blog post', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await blogService.deleteBlogPost('123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle deletion error', async () => {
      const error = new Error('Failed to delete post');
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error }),
      });

      await expect(blogService.deleteBlogPost('123')).rejects.toThrow('Failed to delete post');
    });
  });
});