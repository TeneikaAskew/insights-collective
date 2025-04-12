
import { BlogPost } from '@/types/blog';
import { supabase } from '@/integrations/supabase/client';

// Import the BlueprintEntries as initial data
import { getBlueprintEntries } from './blueprintService';

export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    // Use the blueprint entries instead of querying a non-existent table
    const blueprintEntries = getBlueprintEntries();
    
    // Convert ID from number to string if needed (to match our updated type)
    return blueprintEntries.map(entry => ({
      ...entry,
      id: String(entry.id) // Ensure ID is a string
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
      return {
        ...blueprintPost,
        id: String(blueprintPost.id) // Ensure ID is a string
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching blog post with slug ${slug}:`, error);
    return null;
  }
};

export const createBlogPost = async (blogPost: Omit<BlogPost, 'id'>): Promise<BlogPost | null> => {
  try {
    // Since we don't have a blog_posts table, we'll just log the creation
    // and return a mock successful response for now
    console.log('Creating blog post:', blogPost);
    
    // Generate a mock ID
    const mockId = `temp-${Date.now()}`;
    
    // Return the created post with the mock ID
    return {
      id: mockId,
      ...blogPost
    };
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
};
