
import { BlogPost, BlogFormData, BlogCategory } from '@/types/blog';
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
      return {
        ...blueprintPost,
        status: blueprintPost.status || 'published',
        views: blueprintPost.views || Math.floor(Math.random() * 500) + 50, // Mock data
        readTime: blueprintPost.readTime || calculateReadTime(blueprintPost.content)
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching blog post with slug ${slug}:`, error);
    return null;
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
