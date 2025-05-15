
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { extractRoutes, type RouteInfo } from '@/utils/routeUtils';

type PageVisibility = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

type UserPresence = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_seen: Date;
};

type PageVisibilityContextType = {
  pageVisibility: PageVisibility[];
  isLoading: boolean;
  isPageVisible: (path: string) => boolean;
  updatePageVisibility: (id: string, updates: Partial<PageVisibility>) => Promise<void>;
  refreshPageVisibility: () => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  activeUsers: UserPresence[];
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
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

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

  // Track user presence
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('user-presence');
    // Fixed UserWithProfile type error by using conditional access and proper type casting
    const userStatus = {
      id: user.id,
      first_name: user?.name?.split(' ')[0] || '',
      last_name: user?.name?.split(' ').slice(1).join(' ') || '',
      avatar_url: user?.avatar || '',
      last_seen: new Date(),
      path: location.pathname,
    };

    // Subscribe to presence channel
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presentUsers = Object.values(state).flatMap(
          (presence: any) => presence
        ) as UserPresence[];
        
        // Update active users
        setActiveUsers(presentUsers);
        console.log('Active users:', presentUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userStatus);
        }
      });

    // Update user presence every minute
    const presenceInterval = setInterval(async () => {
      if (channel) {
        await channel.track({
          ...userStatus,
          last_seen: new Date(),
          path: location.pathname,
        });
      }
    }, 60000);

    return () => {
      clearInterval(presenceInterval);
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  // This function will sync available routes with the page_visibility table
  const syncAvailablePages = async () => {
    try {
      // Get all existing routes using the utility function
      const routeElements = document.querySelector('#root')?.firstElementChild?.children;
      if (!routeElements) {
        console.error('Could not find routes in DOM');
        return;
      }
      
      const availableRoutes = extractRoutes(Array.from(routeElements) as any);
      console.log('Extracted routes:', availableRoutes);

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

    // Check root path separately
    if (path === '/') return true;

    // Find exact match or pattern match for the path
    const page = pageVisibility.find(p => {
      // Exact match
      if (p.page_path === path) return true;
      
      // Pattern match for parameterized routes
      if (p.page_path.includes(':')) {
        return matchPathPattern(p.page_path, path);
      }
      
      // Check if path is a sub-path of p.page_path
      // i.e. /courses/123 should match /courses
      if (path.startsWith(p.page_path + '/')) return true;
      
      return false;
    });

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

    // Different segment count and not a sub-path
    if (patternParts.length > pathParts.length) return false;

    // Check each part up to the pattern length
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
        syncAvailablePages,
        activeUsers
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
