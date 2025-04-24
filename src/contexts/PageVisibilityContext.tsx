
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type PageVisibility = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

type PageVisibilityContextType = {
  pageVisibility: PageVisibility[];
  isLoading: boolean;
  isPageVisible: (path: string) => boolean;
  updatePageVisibility: (id: string, updates: Partial<PageVisibility>) => Promise<void>;
  refreshPageVisibility: () => Promise<void>;
  syncAvailablePages: () => Promise<void>;
};

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

// Helper function to extract page names from paths
const getPageNameFromPath = (path: string): string => {
  // Remove leading slash and parameters
  const cleanPath = path.replace(/^\//, '').split(':')[0].replace(/\/$/, '');
  
  // Handle empty path (root)
  if (!cleanPath) return 'Home';
  
  // Convert kebab-case to Title Case
  return cleanPath
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // This hook must be used inside AuthProvider
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPageVisibility = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('page_visibility')
        .select('*')
        .order('page_name');

      if (error) {
        console.error('Error fetching page visibility:', error);
        return;
      }

      setPageVisibility(data || []);
    } catch (error) {
      console.error('Error in fetchPageVisibility:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // This function will sync available routes with the page_visibility table
  const syncAvailablePages = async () => {
    try {
      // Get all existing routes from App.tsx dynamically
      // In a real implementation, this would need to be configured to match your routing system
      // For this example, we'll use a hardcoded list
      const availableRoutes = [
        { path: '/', name: 'Home' },
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/courses', name: 'Courses' },
        { path: '/resources', name: 'Resources' },
        { path: '/data-blueprint', name: 'Data Blueprint' },
        { path: '/blog', name: 'Blog' },
        { path: '/events', name: 'Events' },
        { path: '/notifications', name: 'Notifications' },
        { path: '/explore-data-careers', name: 'Explore Data Careers' },
        { path: '/profile', name: 'Profile' },
        { path: '/calendar', name: 'Calendar' },
        { path: '/assistants', name: 'Assistants' },
        { path: '/messages', name: 'Messages' },
        { path: '/resume', name: 'Resume' },
        { path: '/career-agent', name: 'Career Agent' },
        { path: '/career-pathway', name: 'Career Pathway' },
      ];

      // Get current routes in the visibility table
      const { data: existingRoutes, error: fetchError } = await supabase
        .from('page_visibility')
        .select('page_path');

      if (fetchError) {
        console.error('Error fetching existing routes:', fetchError);
        return;
      }

      // Find routes that need to be added
      const existingPathsSet = new Set((existingRoutes || []).map(r => r.page_path));
      const routesToAdd = availableRoutes.filter(route => !existingPathsSet.has(route.path));

      if (routesToAdd.length > 0) {
        // Insert new routes with default visibility settings
        const { error: insertError } = await supabase
          .from('page_visibility')
          .insert(
            routesToAdd.map(route => ({
              page_path: route.path,
              page_name: route.name,
              visible_to_users: true,
              visible_to_instructors: true,
            }))
          );

        if (insertError) {
          console.error('Error adding new routes to visibility table:', insertError);
        } else {
          console.log(`Added ${routesToAdd.length} new routes to visibility table`);
          // Refresh the visibility data after update
          await fetchPageVisibility();
        }
      }
    } catch (error) {
      console.error('Error in syncAvailablePages:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPageVisibility();
      
      // If user is admin, sync pages
      if (user.role === 'admin') {
        syncAvailablePages();
      }
      
      // Set up interval to sync pages daily (for admins only)
      let syncInterval: number | undefined;
      if (user.role === 'admin') {
        syncInterval = window.setInterval(() => {
          syncAvailablePages();
        }, 24 * 60 * 60 * 1000); // 24 hours
      }
      
      return () => {
        if (syncInterval) clearInterval(syncInterval);
      };
    } else {
      // Handle case when user is not authenticated
      setIsLoading(false);
      setPageVisibility([]);
    }
  }, [user]);

  const isPageVisible = (path: string): boolean => {
    // Admins can always see all pages
    if (user?.role === 'admin') return true;

    // Find exact match or pattern match for the path
    const page = pageVisibility.find(p => 
      p.page_path === path || 
      (p.page_path.includes(':') && matchPathPattern(p.page_path, path))
    );

    if (!page) return true; // If page isn't in the visibility list, default to visible

    // Check user role and page visibility
    if (user?.role === 'instructor') {
      return page.visible_to_instructors;
    }
    
    return page.visible_to_users;
  };

  // Helper to match paths with parameters like /courses/:courseId
  const matchPathPattern = (pattern: string, path: string): boolean => {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return false;

    return patternParts.every((part, i) => 
      part.startsWith(':') || part === pathParts[i]
    );
  };

  const updatePageVisibility = async (id: string, updates: Partial<PageVisibility>) => {
    try {
      const { error } = await supabase
        .from('page_visibility')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating page visibility:', error);
        throw error;
      }

      // Refresh the list after update
      await fetchPageVisibility();
    } catch (error) {
      console.error('Error in updatePageVisibility:', error);
      throw error;
    }
  };

  const refreshPageVisibility = async () => {
    return fetchPageVisibility();
  };

  return (
    <PageVisibilityContext.Provider 
      value={{ 
        pageVisibility, 
        isLoading, 
        isPageVisible, 
        updatePageVisibility,
        refreshPageVisibility,
        syncAvailablePages
      }}
    >
      {children}
    </PageVisibilityContext.Provider>
  );
};

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    throw new Error('usePageVisibility must be used within a PageVisibilityProvider');
  }
  return context;
};
