
import { BlogPost, BlogFormData, BlogCategory, BlogAnalytics } from '@/types/blog';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';
import { sanitizeHTML } from '@/utils/sanitize';

const logger = createLogger('blogService');

/**
 * Get blog posts from Supabase.
 *
 * @param options.publishedOnly Restrict to `status = 'published'` in the query.
 *   The public blog passes this so its correctness does not depend on RLS alone
 *   (defense in depth), and so drafts are never shipped to the browser of an
 *   author or admin who happens to be browsing the public listing.
 */
export const getAllBlogPosts = async (
  options: { publishedOnly?: boolean } = {},
): Promise<BlogPost[]> => {
  try {
    // NOTE: the only FK on blog_posts is fk_blog_posts_category; there is no
    // FK to profiles, so the author names are resolved with a second query.
    // The previous hints (blog_posts_category_id_fkey / blog_posts_author_id_fkey)
    // did not exist and made every fetch fail with PGRST200.
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        blog_categories!fk_blog_posts_category(name),
        blog_post_tags(tag_name)
      `)
      .order('created_at', { ascending: false });

    if (options.publishedOnly) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (error) throw error;

    const authorIds = Array.from(
      new Set((data || []).map((post) => post.author_id).filter(Boolean))
    ) as string[];
    const authorNames = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: authors, error: authorsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', authorIds);
      if (authorsError) throw authorsError;
      (authors || []).forEach((a: any) => {
        authorNames.set(a.id, `${a.first_name || ''} ${a.last_name || ''}`.trim());
      });
    }

    return (data || []).map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      slug: post.slug,
      publishedAt: post.published_at || post.created_at,
      updatedAt: post.updated_at,
      authorId: post.author_id,
      authorName: authorNames.get(post.author_id) || 'Unknown Author',
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
    logger.error('Error fetching blog posts:', error);
    throw error;
  }
};

// Get blog post by slug with real data
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    logger.log('Fetching blog post with slug:', slug);
    
    // First get the blog post
    const { data: postData, error: postError } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    logger.log('Post query result:', { postData, postError });

    if (postError) {
      logger.error('Database error:', postError);
      throw postError;
    }
    
    if (!postData) {
      logger.log('No data found for slug:', slug);
      return null;
    }

    // Get category name
    let categoryName = 'Uncategorized';
    if (postData.category_id) {
      const { data: categoryData, error: categoryError } = await supabase
        .from('blog_categories')
        .select('name')
        .eq('id', postData.category_id)
        .maybeSingle();
      if (categoryError) throw categoryError;
      categoryName = categoryData?.name || 'Uncategorized';
    }

    // Get author name
    let authorName = 'Unknown Author';
    if (postData.author_id) {
      const { data: authorData, error: authorError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', postData.author_id)
        .maybeSingle();
      if (authorError) throw authorError;
      if (authorData) {
        authorName = `${authorData.first_name} ${authorData.last_name}`.trim();
      }
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabase
      .from('blog_post_tags')
      .select('tag_name')
      .eq('blog_post_id', postData.id);

    if (tagsError) throw tagsError;

    const post: BlogPost = {
      id: postData.id,
      title: postData.title,
      content: postData.content,
      excerpt: postData.excerpt,
      slug: postData.slug,
      publishedAt: postData.published_at || postData.created_at,
      updatedAt: postData.updated_at,
      authorId: postData.author_id,
      authorName: authorName,
      imageUrl: postData.image_url,
      tags: tags?.map(tag => tag.tag_name) || [],
      category: categoryName,
      status: postData.status as 'draft' | 'published' | 'archived',
      featured: postData.featured,
      seoTitle: postData.seo_title,
      seoDescription: postData.seo_description,
      views: postData.view_count,
      readTime: postData.read_time
    };

    logger.log('Constructed post object:', post);

    // Record a view for this post
    recordBlogPostView(post.id, post.slug);
    
    return post;
  } catch (error) {
    logger.error(`Error fetching blog post with slug ${slug}:`, error);
    throw error;
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
      const { data: categoryData, error: categoryError } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('name', blogPost.category)
        .maybeSingle();
      if (categoryError) throw categoryError;
      categoryId = categoryData?.id ?? null;
    }

    // Sanitize HTML on write so stored content is clean regardless of how it is
    // later rendered (defense in depth beyond render-time sanitization).
    const sanitizedContent = sanitizeHTML(blogPost.content || '');

    // Calculate read time
    const readTime = calculateReadTime(sanitizedContent);

    // Set published_at if status is published
    const publishedAt = blogPost.status === 'published' ? new Date().toISOString() : null;

    // Insert blog post
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: blogPost.title,
        content: sanitizedContent,
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

      const { error: tagsError } = await supabase
        .from('blog_post_tags')
        .insert(tagInserts);

      if (tagsError) throw tagsError;
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
    logger.error('Error creating blog post:', error);
    throw error;
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
      const { data: categoryData, error: categoryError } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('name', blogPost.category)
        .maybeSingle();
      if (categoryError) throw categoryError;
      categoryId = categoryData?.id ?? null;
    }

    // Sanitize HTML on write (see createBlogPost).
    const sanitizedContent = sanitizeHTML(blogPost.content || '');

    // Calculate read time
    const readTime = calculateReadTime(sanitizedContent);

    // Set published_at if status changed to published
    let publishedAt = undefined;
    if (blogPost.status === 'published' && existingPost.status !== 'published') {
      publishedAt = new Date().toISOString();
    }

    // Update blog post
    const updateData: any = {
      title: blogPost.title,
      content: sanitizedContent,
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
    const { error: tagDeleteError } = await supabase
      .from('blog_post_tags')
      .delete()
      .eq('blog_post_id', existingPost.id);

    if (tagDeleteError) throw tagDeleteError;

    if (blogPost.tags && blogPost.tags.length > 0) {
      const tagInserts = blogPost.tags.map(tag => ({
        blog_post_id: existingPost.id,
        tag_name: tag
      }));

      const { error: tagInsertError } = await supabase
        .from('blog_post_tags')
        .insert(tagInserts);

      if (tagInsertError) throw tagInsertError;
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
    logger.error('Error updating blog post:', error);
    throw error;
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
    logger.error('Error deleting blog post:', error);
    throw error;
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
      // PostgREST returns the (count) embed as [{ count: N }] — using .length
      // made every non-empty category read "1 articles".
      count: category.blog_posts?.[0]?.count ?? 0
    }));
  } catch (error) {
    logger.error('Error fetching blog categories:', error);
    throw error;
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
      // View tracking is non-critical telemetry: warn, but never break the read path.
      logger.warn('Failed to record blog post view (non-critical):', error);
    }

    // Increment via a SECURITY DEFINER RPC. blog_posts has no UPDATE policy for
    // anon, so a direct client-side update matched zero rows for the anonymous
    // visitors who make up most blog traffic — counts never moved. The RPC also
    // makes the increment atomic, where the previous read-then-write lost
    // counts under concurrency. Failures stay fail-quiet: this is telemetry and
    // must never break the read path.
    const { error: rpcError } = await supabase.rpc('increment_blog_post_view', {
      p_post_id: postId,
    });
    if (rpcError) {
      logger.warn('Failed to increment blog post view count (non-critical):', rpcError);
    }
  } catch (error) {
    logger.warn('Error recording blog post view (non-critical):', error);
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
      bounceRate: 0, // No real data source for bounce rate yet
      conversionRate: 0, // No real data source for conversion rate yet
    };
  } catch (error) {
    logger.error('Error fetching blog post analytics:', error);
    throw error;
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
