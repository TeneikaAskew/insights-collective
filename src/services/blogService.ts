import { BlogPost } from '@/types/blog';
import { supabase } from '@/integrations/supabase/client';

// Import the BlueprintEntries as initial data
import { getBlueprintEntries } from './blueprintService';

export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    // First, check Supabase for blog posts
    const { data: supabaseBlogPosts, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // If we got data from Supabase, transform and return it
    if (supabaseBlogPosts && supabaseBlogPosts.length > 0) {
      return supabaseBlogPosts.map(post => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || post.content.substring(0, 150) + '...',
        publishedAt: post.published_at,
        updatedAt: post.updated_at,
        authorId: post.author_id,
        authorName: post.author_name,
        imageUrl: post.image_url,
        tags: post.tags || []
      }));
    }
    
    // If no database posts, fall back to blueprint entries
    const blueprintEntries = getBlueprintEntries();
    
    return blueprintEntries;
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    // Fall back to static data on error
    return getBlueprintEntries();
  }
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    // Try to get from Supabase first
    const { data: supabasePost, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }
    
    // If found in Supabase, transform and return
    if (supabasePost) {
      return {
        id: supabasePost.id,
        slug: supabasePost.slug,
        title: supabasePost.title,
        content: supabasePost.content,
        excerpt: supabasePost.excerpt || supabasePost.content.substring(0, 150) + '...',
        publishedAt: supabasePost.published_at,
        updatedAt: supabasePost.updated_at,
        authorId: supabasePost.author_id,
        authorName: supabasePost.author_name,
        imageUrl: supabasePost.image_url,
        tags: supabasePost.tags || []
      };
    }
    
    // Otherwise, look in blueprint entries
    const blueprintEntries = getBlueprintEntries();
    const blueprintPost = blueprintEntries.find(post => post.slug === slug);
    
    return blueprintPost || null;
  } catch (error) {
    console.error(`Error fetching blog post with slug ${slug}:`, error);
    
    // Fall back to static data on error
    const blueprintEntries = getBlueprintEntries();
    return blueprintEntries.find(post => post.slug === slug) || null;
  }
};

export const createBlogPost = async (blogPost: Omit<BlogPost, 'id'>): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        slug: blogPost.slug,
        title: blogPost.title,
        content: blogPost.content,
        excerpt: blogPost.excerpt,
        published_at: blogPost.publishedAt || new Date().toISOString(),
        author_id: blogPost.authorId,
        author_name: blogPost.authorName,
        image_url: blogPost.imageUrl,
        tags: blogPost.tags
      })
      .select()
      .single();
    
    if (error) throw error;
    
    if (data) {
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || data.content.substring(0, 150) + '...',
        publishedAt: data.published_at,
        updatedAt: data.updated_at,
        authorId: data.author_id,
        authorName: data.author_name,
        imageUrl: data.image_url,
        tags: data.tags || []
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
};
