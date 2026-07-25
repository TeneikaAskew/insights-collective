import { supabase } from '@/integrations/supabase/client';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'scheduled';
  author_id: string;
  category_id?: string;
  reading_time?: number;
  views_count: number;
  likes_count: number;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  og_image?: string;
  custom_slug?: string;
  scheduled_at?: string;
  is_featured: boolean;
  allow_comments: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogMedia {
  id: string;
  url: string;
  alt_text?: string;
  caption?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  width?: number;
  height?: number;
  metadata?: any;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface BlogAnalytics {
  id: string;
  blog_post_id: string;
  date: string;
  views: number;
  unique_visitors: number;
  avg_time_on_page?: any;
  bounce_rate?: number;
  referrer_data?: any;
  created_at: string;
}

export interface BlogComment {
  id: string;
  blog_post_id: string;
  author_id?: string;
  parent_id?: string;
  content: string;
  is_approved: boolean;
  is_spam: boolean;
  created_at: string;
  updated_at: string;
}

class BlogServiceV2 {
  // Blog Posts
  async getPosts(filters?: {
    status?: string;
    category_id?: string;
    author_id?: string;
    is_featured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles!author_id (
          id,
          first_name,
          last_name,
          avatar_url
        ),
        category:blog_categories (
          id,
          name,
          slug
        ),
        blog_post_tags (
          tag_id,
          blog_tags (
            id,
            name,
            slug
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters?.author_id) {
      query = query.eq('author_id', filters.author_id);
    }
    if (filters?.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getPostById(id: string) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles!author_id (
          id,
          first_name,
          last_name,
          avatar_url
        ),
        category:blog_categories (
          id,
          name,
          slug
        ),
        blog_post_tags (
          tag_id,
          blog_tags (
            id,
            name,
            slug
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getPostBySlug(slug: string) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles!author_id (
          id,
          first_name,
          last_name,
          avatar_url
        ),
        category:blog_categories (
          id,
          name,
          slug
        ),
        blog_post_tags (
          tag_id,
          blog_tags (
            id,
            name,
            slug
          )
        )
      `)
      .or(`slug.eq.${slug},custom_slug.eq.${slug}`)
      .single();

    if (error) throw error;
    return data;
  }

  async createPost(post: Partial<BlogPost>) {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert(post)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePost(id: string, updates: Partial<BlogPost>) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deletePost(id: string) {
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async incrementPostViews(id: string) {
    const { error } = await supabase.rpc('increment_blog_views', {
      post_id: id,
    });

    if (error) throw error;
  }

  async togglePostLike(postId: string, userId: string) {
    // This would need a likes table to be implemented properly
    // For now, just increment/decrement the count
    const { data: post } = await this.getPostById(postId);
    if (!post) throw new Error('Post not found');

    const { error } = await supabase
      .from('blog_posts')
      .update({ likes_count: post.likes_count + 1 })
      .eq('id', postId);

    if (error) throw error;
  }

  // Categories
  async getCategories() {
    const { data, error } = await supabase
      .from('blog_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  }

  async getCategoryById(id: string) {
    const { data, error } = await supabase
      .from('blog_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createCategory(category: Partial<BlogCategory>) {
    const { data, error } = await supabase
      .from('blog_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, updates: Partial<BlogCategory>) {
    const { data, error } = await supabase
      .from('blog_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string) {
    const { error } = await supabase
      .from('blog_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Tags
  async getTags() {
    const { data, error } = await supabase
      .from('blog_tags')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  }

  async createTag(tag: Partial<BlogTag>) {
    const { data, error } = await supabase
      .from('blog_tags')
      .insert(tag)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addTagsToPost(postId: string, tagIds: string[]) {
    const tags = tagIds.map(tagId => ({
      blog_post_id: postId,
      tag_id: tagId,
    }));

    const { error } = await supabase
      .from('blog_post_tags')
      .insert(tags);

    if (error) throw error;
  }

  async removeTagsFromPost(postId: string, tagIds?: string[]) {
    let query = supabase
      .from('blog_post_tags')
      .delete()
      .eq('blog_post_id', postId);

    if (tagIds && tagIds.length > 0) {
      query = query.in('tag_id', tagIds);
    }

    const { error } = await query;
    if (error) throw error;
  }

  // Media
  async getMedia(filters?: {
    author_id?: string;
    file_type?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('blog_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.author_id) {
      query = query.eq('author_id', filters.author_id);
    }
    if (filters?.file_type) {
      query = query.like('file_type', `${filters.file_type}%`);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async uploadMedia(file: File, userId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('blog-media')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('blog-media')
      .getPublicUrl(fileName);

    // Get image dimensions if it's an image
    let width, height;
    if (file.type.startsWith('image/')) {
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = URL.createObjectURL(file);
      });
      width = img.width;
      height = img.height;
    }

    const { data, error } = await supabase
      .from('blog_media')
      .insert({
        url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        width,
        height,
        author_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMedia(id: string) {
    const { data: media, error: fetchError } = await supabase
      .from('blog_media')
      .select('url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const path = media.url.split('/').slice(-2).join('/');
    const { error: storageError } = await supabase.storage
      .from('blog-media')
      .remove([path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error } = await supabase
      .from('blog_media')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Analytics
  async getPostAnalytics(postId: string, dateRange?: { start: Date; end: Date }) {
    let query = supabase
      .from('blog_analytics')
      .select('*')
      .eq('blog_post_id', postId)
      .order('date', { ascending: true });

    if (dateRange) {
      query = query
        .gte('date', dateRange.start.toISOString())
        .lte('date', dateRange.end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async trackPageView(postId: string, referrer?: string) {
    const today = new Date().toISOString().split('T')[0];

    // This would typically be handled by a backend function
    // For now, we'll just increment the view count
    const { error } = await supabase.rpc('track_blog_view', {
      post_id: postId,
      view_date: today,
      referrer_url: referrer,
    });

    if (error) throw error;
  }

  // Comments
  async getComments(postId: string, options?: { 
    includeUnapproved?: boolean;
    parentId?: string | null;
  }) {
    let query = supabase
      .from('blog_comments')
      .select(`
        *,
        author:profiles!author_id (
          id,
          first_name,
          last_name,
          avatar_url
        ),
        replies:blog_comments!parent_id (
          id,
          content,
          author_id,
          is_approved,
          created_at
        )
      `)
      .eq('blog_post_id', postId)
      .order('created_at', { ascending: true });

    if (!options?.includeUnapproved) {
      query = query.eq('is_approved', true);
    }

    if (options?.parentId !== undefined) {
      query = query.is('parent_id', options.parentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async createComment(comment: {
    blog_post_id: string;
    author_id: string;
    content: string;
    parent_id?: string;
  }) {
    const { data, error } = await supabase
      .from('blog_comments')
      .insert(comment)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async approveComment(id: string) {
    const { error } = await supabase
      .from('blog_comments')
      .update({ is_approved: true })
      .eq('id', id);

    if (error) throw error;
  }

  async markCommentAsSpam(id: string) {
    const { error } = await supabase
      .from('blog_comments')
      .update({ is_spam: true, is_approved: false })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteComment(id: string) {
    const { error } = await supabase
      .from('blog_comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const blogServiceV2 = new BlogServiceV2();