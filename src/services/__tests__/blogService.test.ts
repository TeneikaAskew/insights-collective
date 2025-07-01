import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as blogService from '../blogService';
import { BlogFormData } from '@/types/blog';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

describe('blogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllBlogPosts', () => {
    it('should fetch all blog posts', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'First Post',
          slug: 'first-post',
          content: 'Content here',
          excerpt: 'Excerpt here',
          status: 'published',
          published_at: '2024-01-01',
          blog_categories: { name: 'Tech' },
          blog_post_tags: [{ tag_name: 'javascript' }],
          profiles: { first_name: 'John', last_name: 'Doe' },
          view_count: 10,
          read_time: 5,
        },
        {
          id: '2',
          title: 'Second Post',
          slug: 'second-post',
          content: 'More content',
          excerpt: 'Another excerpt',
          status: 'published',
          published_at: '2024-01-02',
          blog_categories: { name: 'Design' },
          blog_post_tags: [{ tag_name: 'ui' }],
          profiles: { first_name: 'Jane', last_name: 'Smith' },
          view_count: 20,
          read_time: 7,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
      });

      const result = await blogService.getAllBlogPosts();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('First Post');
      expect(result[0].category).toBe('Tech');
      expect(result[0].authorName).toBe('John Doe');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
    });

    it('should handle fetch error', async () => {
      const error = new Error('Failed to fetch posts');
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error }),
      });

      const result = await blogService.getAllBlogPosts();
      expect(result).toEqual([]);
    });
  });

  describe('getBlogPostBySlug', () => {
    it('should fetch a single blog post by slug', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Test content',
        excerpt: 'Test excerpt',
        status: 'published',
        published_at: '2024-01-01',
        blog_categories: { name: 'Tech' },
        blog_post_tags: [{ tag_name: 'test' }],
        profiles: { first_name: 'John', last_name: 'Doe' },
        view_count: 5,
        read_time: 3,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
      });

      const result = await blogService.getBlogPostBySlug('test-post');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Post');
      expect(result?.slug).toBe('test-post');
      expect(result?.category).toBe('Tech');
      expect(result?.authorName).toBe('John Doe');
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
      const newPost: BlogFormData = {
        title: 'New Post',
        slug: 'new-post',
        content: 'New content',
        excerpt: 'New excerpt',
        tags: ['test'],
        status: 'published',
      };

      const createdPost = { 
        id: '123',
        title: 'New Post',
        slug: 'new-post',
        content: 'New content',
        excerpt: 'New excerpt',
        status: 'published',
        author_id: 'user123',
        blog_post_tags: [],
      };

      // Mock auth user
      mockSupabaseClient.auth = {
        getUser: vi.fn().mockResolvedValue({ 
          data: { user: { id: 'user123' } }, 
          error: null 
        }),
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdPost, error: null }),
      });

      const result = await blogService.createBlogPost(newPost);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('New Post');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
    });

    it('should handle creation error', async () => {
      // Mock auth user
      mockSupabaseClient.auth = {
        getUser: vi.fn().mockResolvedValue({ 
          data: { user: { id: 'user123' } }, 
          error: null 
        }),
      };

      const error = new Error('Failed to create post');
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error }),
      });

      const result = await blogService.createBlogPost({} as any);
      expect(result).toBeNull();
    });
  });

  describe('updateBlogPost', () => {
    it('should update an existing blog post', async () => {
      const updates: BlogFormData = {
        title: 'Updated Title',
        content: 'Updated content',
        excerpt: 'Updated excerpt',
        slug: 'test-post',
        tags: ['updated'],
        status: 'published',
      };

      const existingPost = {
        id: '123',
        slug: 'test-post',
        status: 'draft',
      };

      const updatedPost = { 
        id: '123',
        ...updates,
        author_id: 'user123',
      };

      // Mock getting existing post
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingPost, error: null }),
      });

      // Mock update
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedPost, error: null }),
      });

      const result = await blogService.updateBlogPost('test-post', updates);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Updated Title');
    });
  });

  describe('deleteBlogPost', () => {
    it('should delete a blog post by slug', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await blogService.deleteBlogPost('test-post');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blog_posts');
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('slug', 'test-post');
    });

    it('should handle deletion error', async () => {
      const error = new Error('Failed to delete post');
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error }),
      });

      const result = await blogService.deleteBlogPost('test-post');
      expect(result).toBe(false);
    });
  });
});