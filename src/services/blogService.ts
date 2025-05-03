import { BlogPost, BlogFormData, BlogCategory, BlogAnalytics } from '@/types/blog';
import { supabase } from '@/integrations/supabase/client';

// Import the BlueprintEntries as initial data
import { getBlueprintEntries } from './blueprintService';

export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    // Use the blueprint entries instead of querying a non-existent table
    const blueprintEntries = getBlueprintEntries();
    
    // Add status field to existing entries if not present
    return blueprintEntries.map(entry => ({
      ...entry,
      status: entry.status || 'published',
      views: entry.views || Math.floor(Math.random() * 500) + 50, // Mock data
      readTime: entry.readTime || calculateReadTime(entry.content)
    }));
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    // Use the blueprint entries
    const blueprintEntries = getBlueprintEntries();
    const blueprintPost = blueprintEntries.find(post => post.slug === slug);
    
    if (blueprintPost) {
      // Add status field and other new fields if not present
      const post = {
        ...blueprintPost,
        status: blueprintPost.status || 'published',
        views: blueprintPost.views || Math.floor(Math.random() * 500) + 50, // Mock data
        readTime: blueprintPost.readTime || calculateReadTime(blueprintPost.content)
      };
      
      // Record a view for this post
      recordBlogPostView(post.id, post.slug);
      
      return post;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching blog post with slug ${slug}:`, error);
    return null;
  }
};

// Record a view for a blog post
export const recordBlogPostView = async (postId: string, slug: string) => {
  try {
    // Get client IP (or a hash) to count unique visitors
    // In a real implementation, you'd use something like a hashed session ID
    const visitorId = crypto.randomUUID(); // Mock unique visitor ID
    
    // Record the analytics event
    const { error } = await supabase
      .from('blog_post_views')
      .insert({
        post_id: postId,
        post_slug: slug,
        visitor_id: visitorId,
        view_duration: 0, // This would be updated later
        view_date: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error recording blog post view:', error);
    }
    
  } catch (error) {
    console.error('Error recording blog post view:', error);
  }
};

// Update the view duration - would be called when user leaves page
export const updateViewDuration = async (viewId: string, durationSeconds: number) => {
  try {
    const { error } = await supabase
      .from('blog_post_views')
      .update({ view_duration: durationSeconds })
      .eq('id', viewId);
      
    if (error) {
      console.error('Error updating view duration:', error);
    }
  } catch (error) {
    console.error('Error updating view duration:', error);
  }
};

// Helper function to generate sample trend data
const generateTrendData = (value: number, min: number, max: number, isPositiveBetter = true) => {
  const percentChange = Math.random() * 20 - 10; // Random percent between -10% and +10%
  const direction: 'up' | 'down' | 'neutral' = 
    percentChange > 1 ? 'up' :
    percentChange < -1 ? 'down' : 'neutral';
  
  const isGood = (direction === 'up' && isPositiveBetter) || (direction === 'down' && !isPositiveBetter);
  
  return {
    direction,
    value: `${Math.abs(percentChange).toFixed(1)}% from last period`,
    isPositive: isGood
  };
};

// Get blog post analytics
export const getBlogPostAnalytics = async (
  slug?: string, 
  timeframe: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<BlogAnalytics> => {
  try {
    // In a real implementation, this would fetch actual data from the database
    // For now, generate sample data
    
    // Sample analytics data
    const baseViews = slug ? Math.floor(Math.random() * 2000) + 100 : Math.floor(Math.random() * 10000) + 1000;
    const baseVisitors = Math.floor(baseViews * (0.6 + Math.random() * 0.3)); // 60-90% of views
    const baseTimeOnPage = Math.floor(Math.random() * 120) + 30; // 30-150 seconds
    const baseConversionRate = Math.random() * 5 + 1; // 1-6%
    const baseBounceRate = Math.random() * 30 + 30; // 30-60%
    
    // Apply timeframe factor
    const timeframeFactor = timeframe === '7d' ? 0.3 : 
                           timeframe === '30d' ? 1 : 
                           timeframe === '90d' ? 2.5 : 3.5;
    
    const analytics: BlogAnalytics = {
      views: Math.floor(baseViews * timeframeFactor),
      uniqueVisitors: Math.floor(baseVisitors * timeframeFactor),
      averageTimeOnPage: baseTimeOnPage,
      bounceRate: baseBounceRate,
      conversionRate: baseConversionRate,
      // Add trend data
      viewsTrend: generateTrendData(baseViews, 500, 10000, true),
      visitorsTrend: generateTrendData(baseVisitors, 300, 7000, true),
      timeTrend: generateTrendData(baseTimeOnPage, 30, 150, true),
      conversionTrend: generateTrendData(baseConversionRate, 1, 6, true),
      bounceTrend: generateTrendData(baseBounceRate, 30, 60, false),
    };
    
    return analytics;
  } catch (error) {
    console.error('Error fetching blog post analytics:', error);
    
    // Return default values if there's an error
    return {
      views: 0,
      uniqueVisitors: 0,
      averageTimeOnPage: 0,
      bounceRate: 0,
      conversionRate: 0
    };
  }
};

export const createBlogPost = async (blogPost: BlogFormData): Promise<BlogPost | null> => {
  try {
    // Generate a mock ID
    const mockId = `temp-${Date.now()}`;
    
    // Calculate read time
    const readTime = calculateReadTime(blogPost.content);
    
    // Return the created post with the mock ID
    const newPost: BlogPost = {
      id: mockId,
      publishedAt: new Date().toISOString(),
      views: 0,
      readTime,
      ...blogPost,
      status: blogPost.status || 'draft'
    };
    
    console.log('Creating blog post:', newPost);
    return newPost;
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
};

export const updateBlogPost = async (slug: string, blogPost: BlogFormData): Promise<BlogPost | null> => {
  try {
    // Get the existing post
    const existingPost = await getBlogPostBySlug(slug);
    
    if (!existingPost) {
      console.error(`Blog post with slug ${slug} not found`);
      return null;
    }
    
    // Update the blog post
    const updatedPost: BlogPost = {
      ...existingPost,
      ...blogPost,
      updatedAt: new Date().toISOString(),
      readTime: calculateReadTime(blogPost.content)
    };
    
    console.log('Updating blog post:', updatedPost);
    return updatedPost;
  } catch (error) {
    console.error('Error updating blog post:', error);
    return null;
  }
};

export const deleteBlogPost = async (slug: string): Promise<boolean> => {
  try {
    // In a real implementation, this would delete from the database
    console.log(`Deleting blog post with slug: ${slug}`);
    return true;
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return false;
  }
};

export const getBlogCategories = async (): Promise<BlogCategory[]> => {
  try {
    const posts = await getAllBlogPosts();
    
    // Extract unique categories
    const categoriesMap = posts.reduce((acc, post) => {
      const category = post.category || 'Uncategorized';
      
      if (!acc[category]) {
        acc[category] = {
          name: category,
          slug: category.toLowerCase().replace(/\s+/g, '-'),
          count: 1
        };
      } else {
        acc[category].count = (acc[category].count || 0) + 1;
      }
      
      return acc;
    }, {} as Record<string, BlogCategory>);
    
    return Object.values(categoriesMap);
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    return [];
  }
};

export const getBlogPostsByCategory = async (category: string): Promise<BlogPost[]> => {
  try {
    const posts = await getAllBlogPosts();
    return posts.filter(post => 
      (post.category || 'Uncategorized').toLowerCase() === category.toLowerCase()
    );
  } catch (error) {
    console.error(`Error fetching blog posts for category ${category}:`, error);
    return [];
  }
};

export const getBlogPostsByTag = async (tag: string): Promise<BlogPost[]> => {
  try {
    const posts = await getAllBlogPosts();
    return posts.filter(post => 
      post.tags && post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  } catch (error) {
    console.error(`Error fetching blog posts for tag ${tag}:`, error);
    return [];
  }
};

export const getFeaturedBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const posts = await getAllBlogPosts();
    return posts
      .filter(post => post.featured)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 5);
  } catch (error) {
    console.error('Error fetching featured blog posts:', error);
    return [];
  }
};

// Helper function to calculate read time
const calculateReadTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};
