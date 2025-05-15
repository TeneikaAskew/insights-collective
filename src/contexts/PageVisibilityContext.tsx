
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { extractRoutes, extractRouteName, type RouteInfo } from '@/utils/routeUtils';

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
  syncAvailablePages: () => Promise<{added: number}>;
  activeSessions: UserSession[];
};

type UserSession = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  path: string;
  lastActive: string;
};

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);

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

  // Enhanced function to sync available routes with the page_visibility table
  const syncAvailablePages = async () => {
    try {
      // Get all existing routes from DOM and sidebar navigation
      const routeElements = document.querySelector('#root')?.firstElementChild?.children;
      if (!routeElements) {
        console.error('Could not find routes in DOM');
        return { added: 0 };
      }
      
      // Extract routes from React Router DOM structure
      const availableRoutes = extractRoutes(Array.from(routeElements) as any);
      console.log('Extracted routes from DOM:', availableRoutes);
      
      // Get routes from sidebar/navigation components
      // This attempts to find navigation data in the window object 
      // that may have been exposed by Sidebar.tsx or AppSidebar.tsx
      let navigationRoutes: RouteInfo[] = [];
      try {
        const navData = document.querySelectorAll('a[href^="/"]');
        if (navData && navData.length > 0) {
          navData.forEach(link => {
            const href = (link as HTMLAnchorElement).getAttribute('href');
            if (href && href.startsWith('/') && !href.includes('#')) {
              navigationRoutes.push({
                path: href,
                name: extractRouteName(href)
              });
            }
          });
        }
        console.log('Extracted routes from navigation:', navigationRoutes);
      } catch (e) {
        console.warn('Could not extract navigation routes:', e);
      }
      
      // Combine all unique routes
      const allRoutes = [...availableRoutes];
      navigationRoutes.forEach(navRoute => {
        if (!allRoutes.some(r => r.path === navRoute.path)) {
          allRoutes.push(navRoute);
        }
      });
      
      console.log('Combined all routes:', allRoutes);

      // Get current routes in the visibility table
      const { data: existingRoutes, error: fetchError } = await supabase
        .from('page_visibility')
        .select('page_path');

      if (fetchError) {
        console.error('Error fetching existing routes:', fetchError);
        return { added: 0 };
      }

      // Find routes that need to be added
      const existingPathsSet = new Set((existingRoutes || []).map(r => r.path ? r.path : r.page_path));
      const routesToAdd = allRoutes.filter(route => !existingPathsSet.has(route.path));

      if (routesToAdd.length > 0) {
        // Insert new routes with default visibility settings
        const { error: insertError } = await supabase
          .from('page_visibility')
          .insert(
            routesToAdd.map(route => ({
              page_path: route.path,
              page_name: route.name || extractRouteName(route.path),
              visible_to_users: true,
              visible_to_instructors: true,
            }))
          );

        if (insertError) {
          console.error('Error adding new routes to visibility table:', insertError);
          return { added: 0 };
        } else {
          console.log(`Added ${routesToAdd.length} new routes to visibility table`);
          // Refresh the visibility data after update
          await fetchPageVisibility();
          return { added: routesToAdd.length };
        }
      }
      
      return { added: 0 };
    } catch (error) {
      console.error('Error in syncAvailablePages:', error);
      return { added: 0 };
    }
  };

  // Set up user presence tracking
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users');
    
    // Define user presence data
    const userPresence = {
      id: user.id,
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Anonymous',
      email: user.email || '',
      avatar: user.avatar_url || user.avatar,
      path: location.pathname,
      lastActive: new Date().toISOString()
    };

    // Subscribe to presence channel
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userStates = Object.values(state).flat() as UserSession[];
        setActiveSessions(userStates);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        
        // Start tracking presence
        const presenceTrackStatus = await channel.track(userPresence);
        console.log('Presence tracking status:', presenceTrackStatus);
      });

    // Update path when user navigates
    const updatePath = () => {
      channel.track({
        ...userPresence,
        path: location.pathname,
        lastActive: new Date().toISOString()
      });
    };

    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    if (user) {
      fetchPageVisibility();
      
      // If user is admin, sync pages on mount
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
    if (user?.role === 'admin' || user?.roles?.includes('admin')) return true;

    // Find exact match or pattern match for the path
    const page = pageVisibility.find(p => 
      p.page_path === path || 
      (p.page_path.includes(':') && matchPathPattern(p.page_path, path))
    );

    if (!page) return true; // If page isn't in the visibility list, default to visible

    // Check user role and page visibility
    if (user?.role === 'instructor' || user?.roles?.includes('instructor')) {
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
        syncAvailablePages,
        activeSessions
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
