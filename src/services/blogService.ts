
import { BlogPost, BlogFormData, BlogCategory, BlogAnalytics } from '@/types/blog';
import { supabase } from '@/integrations/supabase/client';

// Get all blog posts with real data from Supabase
export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        blog_categories!blog_posts_category_id_fkey(name),
        blog_post_tags(tag_name),
        profiles!blog_posts_author_id_fkey(first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      slug: post.slug,
      publishedAt: post.published_at || post.created_at,
      updatedAt: post.updated_at,
      authorId: post.author_id,
      authorName: post.profiles ? `${post.profiles.first_name} ${post.profiles.last_name}`.trim() : 'Unknown Author',
      imageUrl: post.image_url,
      tags: post.blog_post_tags?.map((tag: any) => tag.tag_name) || [],
      category: post.blog_categories?.name || 'Uncategorized',
      status: post.status as 'draft' | 'published' | 'archived',
      featured: post.featured,
      seoTitle: post.seo_title,
      seoDescription: post.seo_description,
      views: post.view_count,
      readTime: post.read_time
    }));
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
};

// Get blog post by slug with real data
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    console.log('Fetching blog post with slug:', slug);
    
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        blog_categories!inner(name),
        profiles!inner(first_name, last_name)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    console.log('Query result:', { data, error });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    if (!data) {
      console.log('No data found for slug:', slug);
      return null;
    }

    // Get tags separately
    const { data: tags } = await supabase
      .from('blog_post_tags')
      .select('tag_name')
      .eq('blog_post_id', data.id);

    const post: BlogPost = {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      publishedAt: data.published_at || data.created_at,
      updatedAt: data.updated_at,
      authorId: data.author_id,
      authorName: data.profiles ? `${data.profiles.first_name} ${data.profiles.last_name}`.trim() : 'Unknown Author',
      imageUrl: data.image_url,
      tags: tags?.map(tag => tag.tag_name) || [],
      category: data.blog_categories?.name || 'Uncategorized',
      status: data.status as 'draft' | 'published' | 'archived',
      featured: data.featured,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      views: data.view_count,
      readTime: data.read_time
    };

    console.log('Constructed post object:', post);

    // Record a view for this post
    recordBlogPostView(post.id, post.slug);
    
    return post;
  } catch (error) {
    console.error(`Error fetching blog post with slug ${slug}:`, error);
    return null;
  }
};

// Create a new blog post
export const createBlogPost = async (blogPost: BlogFormData): Promise<BlogPost | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get category ID if category is provided
    let categoryId = null;
    if (blogPost.category) {
      const { data: categoryData } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('name', blogPost.category)
        .single();
      categoryId = categoryData?.id;
    }

    // Calculate read time
    const readTime = calculateReadTime(blogPost.content);

    // Set published_at if status is published
    const publishedAt = blogPost.status === 'published' ? new Date().toISOString() : null;

    // Insert blog post
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: blogPost.title,
        content: blogPost.content,
        excerpt: blogPost.excerpt,
        slug: blogPost.slug,
        author_id: user.id,
        image_url: blogPost.imageUrl,
        status: blogPost.status || 'draft',
        featured: blogPost.featured || false,
        seo_title: blogPost.seoTitle,
        seo_description: blogPost.seoDescription,
        category_id: categoryId,
        read_time: readTime,
        published_at: publishedAt
      })
      .select()
      .single();

    if (error) throw error;

    // Insert tags if provided
    if (blogPost.tags && blogPost.tags.length > 0) {
      const tagInserts = blogPost.tags.map(tag => ({
        blog_post_id: data.id,
        tag_name: tag
      }));

      await supabase
        .from('blog_post_tags')
        .insert(tagInserts);
    }

    // Get author information for return
    const { data: authorData } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      publishedAt: data.published_at || data.created_at,
      updatedAt: data.updated_at,
      authorId: data.author_id,
      authorName: authorData ? `${authorData.first_name} ${authorData.last_name}`.trim() : 'Unknown Author',
      imageUrl: data.image_url,
      tags: blogPost.tags || [],
      category: blogPost.category || 'Uncategorized',
      status: data.status as 'draft' | 'published' | 'archived',
      featured: data.featured,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      views: data.view_count,
      readTime: data.read_time
    };
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
};

// Update blog post
export const updateBlogPost = async (slug: string, blogPost: BlogFormData): Promise<BlogPost | null> => {
  try {
    // Get the existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, author_id, status')
      .eq('slug', slug)
      .single();

    if (fetchError) throw fetchError;
    if (!existingPost) return null;

    // Get category ID if category is provided
    let categoryId = null;
    if (blogPost.category) {
      const { data: categoryData } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('name', blogPost.category)
        .single();
      categoryId = categoryData?.id;
    }

    // Calculate read time
    const readTime = calculateReadTime(blogPost.content);

    // Set published_at if status changed to published
    let publishedAt = undefined;
    if (blogPost.status === 'published' && existingPost.status !== 'published') {
      publishedAt = new Date().toISOString();
    }

    // Update blog post
    const updateData: any = {
      title: blogPost.title,
      content: blogPost.content,
      excerpt: blogPost.excerpt,
      slug: blogPost.slug,
      image_url: blogPost.imageUrl,
      status: blogPost.status || 'draft',
      featured: blogPost.featured || false,
      seo_title: blogPost.seoTitle,
      seo_description: blogPost.seoDescription,
      category_id: categoryId,
      read_time: readTime
    };

    if (publishedAt) {
      updateData.published_at = publishedAt;
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', existingPost.id)
      .select()
      .single();

    if (error) throw error;

    // Update tags - delete existing and insert new ones
    await supabase
      .from('blog_post_tags')
      .delete()
      .eq('blog_post_id', existingPost.id);

    if (blogPost.tags && blogPost.tags.length > 0) {
      const tagInserts = blogPost.tags.map(tag => ({
        blog_post_id: existingPost.id,
        tag_name: tag
      }));

      await supabase
        .from('blog_post_tags')
        .insert(tagInserts);
    }

    // Get author information for return  
    const { data: authorData } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', data.author_id)
      .single();

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      publishedAt: data.published_at || data.created_at,
      updatedAt: data.updated_at,
      authorId: data.author_id,
      authorName: authorData ? `${authorData.first_name} ${authorData.last_name}`.trim() : 'Unknown Author',
      imageUrl: data.image_url,
      tags: blogPost.tags || [],
      category: blogPost.category || 'Uncategorized',
      status: data.status as 'draft' | 'published' | 'archived',
      featured: data.featured,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      views: data.view_count,
      readTime: data.read_time
    };
  } catch (error) {
    console.error('Error updating blog post:', error);
    return null;
  }
};

// Delete blog post
export const deleteBlogPost = async (slug: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('slug', slug);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return false;
  }
};

// Get blog categories
export const getBlogCategories = async (): Promise<BlogCategory[]> => {
  try {
    const { data, error } = await supabase
      .from('blog_categories')
      .select(`
        *,
        blog_posts(count)
      `)
      .order('name');

    if (error) throw error;

    return (data || []).map(category => ({
      name: category.name,
      slug: category.slug,
      description: category.description,
      count: category.blog_posts?.length || 0
    }));
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    return [];
  }
};

// Record a view for a blog post
export const recordBlogPostView = async (postId: string, slug: string) => {
  try {
    const visitorId = crypto.randomUUID();
    
    const { error } = await supabase
      .from('blog_post_views')
      .insert({
        post_id: postId,
        post_slug: slug,
        visitor_id: visitorId,
        view_duration: 0,
        view_date: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error recording blog post view:', error);
    }

    // Update view count on the post
    await supabase.rpc('increment', {
      table_name: 'blog_posts',
      row_id: postId,
      column_name: 'view_count'
    });
    
  } catch (error) {
    console.error('Error recording blog post view:', error);
  }
};

// Get blog post analytics
export const getBlogPostAnalytics = async (
  slug?: string, 
  timeframe: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<BlogAnalytics> => {
  try {
    let query = supabase
      .from('blog_post_views')
      .select('*');

    if (slug) {
      query = query.eq('post_slug', slug);
    }

    // Apply timeframe filter
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    if (timeframe !== 'all') {
      query = query.gte('view_date', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    const views = data?.length || 0;
    const uniqueVisitors = new Set(data?.map(view => view.visitor_id)).size;
    const averageTimeOnPage = data?.length > 0 
      ? data.reduce((sum, view) => sum + (view.view_duration || 0), 0) / data.length 
      : 0;

    return {
      views,
      uniqueVisitors,
      averageTimeOnPage,
      bounceRate: Math.random() * 30 + 30, // Mock data for now
      conversionRate: Math.random() * 5 + 1, // Mock data for now
    };
  } catch (error) {
    console.error('Error fetching blog post analytics:', error);
    
    return {
      views: 0,
      uniqueVisitors: 0,
      averageTimeOnPage: 0,
      bounceRate: 0,
      conversionRate: 0
    };
  }
};

// Helper functions
export const getBlogPostsByCategory = async (category: string): Promise<BlogPost[]> => {
  const posts = await getAllBlogPosts();
  return posts.filter(post => 
    post.category?.toLowerCase() === category.toLowerCase()
  );
};

export const getBlogPostsByTag = async (tag: string): Promise<BlogPost[]> => {
  const posts = await getAllBlogPosts();
  return posts.filter(post => 
    post.tags && post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
};

export const getFeaturedBlogPosts = async (): Promise<BlogPost[]> => {
  const posts = await getAllBlogPosts();
  return posts
    .filter(post => post.featured && post.status === 'published')
    .slice(0, 5);
};

// Helper function to calculate read time
const calculateReadTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};
