
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { extractRoutes, type RouteInfo } from '@/utils/routeUtils';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

// Define types for presence data
type UserPresence = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  online_at: string;
};

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
  onlineUsers: UserPresence[];
  currentUserPresence: UserPresence | null;
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
  const { user } = useAuth();
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<UserPresence | null>(null);

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

  // Improved function to sync available routes with the page_visibility table
  const syncAvailablePages = async () => {
    try {
      setIsLoading(true);
      
      // Get all existing routes using the DOM route components
      const routeElements = document.querySelector('#root')?.firstElementChild?.children;
      if (!routeElements) {
        console.error('Could not find routes in DOM');
        setIsLoading(false);
        return;
      }
      
      // Extract all routes from the Router component
      const availableRoutes = extractRoutes(Array.from(routeElements) as any);
      console.log('Extracted routes from DOM:', availableRoutes);

      // Get additional routes from sidebar configuration
      const sidebarRoutes = extractRoutesFromSidebar();
      console.log('Extracted routes from sidebar:', sidebarRoutes);

      // Merge routes from both sources, removing duplicates
      const allRoutes = mergeRoutes(availableRoutes, sidebarRoutes);
      console.log('Merged routes:', allRoutes);

      // Get current routes in the visibility table
      const { data: existingRoutes, error: fetchError } = await supabase
        .from('page_visibility')
        .select('page_path');

      if (fetchError) {
        console.error('Error fetching existing routes:', fetchError);
        setIsLoading(false);
        return;
      }

      // Find routes that need to be added
      const existingPathsSet = new Set((existingRoutes || []).map(r => r.page_path));
      const routesToAdd = allRoutes.filter(route => !existingPathsSet.has(route.path));

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
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error in syncAvailablePages:', error);
      setIsLoading(false);
    }
  };

  // Function to extract routes from sidebar configuration
  const extractRoutesFromSidebar = (): RouteInfo[] => {
    // Try to extract routes from sidebar links in the DOM
    const sidebarRoutes: RouteInfo[] = [];
    try {
      // Find all anchor tags in the sidebar that have href attributes
      const sidebarLinks = document.querySelectorAll('.sidebar a[href], nav a[href]');
      
      sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && href !== '#' && !href.startsWith('mailto:')) {
          // Parse the href to get the path
          const path = href.startsWith('/') ? href : `/${href}`;
          // Get text content for the name
          const name = link.textContent?.trim() || getPageNameFromPath(path);
          
          sidebarRoutes.push({
            path,
            name
          });
        }
      });
    } catch (error) {
      console.error('Error extracting routes from sidebar:', error);
    }
    
    return sidebarRoutes;
  };

  // Function to merge routes from different sources and remove duplicates
  const mergeRoutes = (routesA: RouteInfo[], routesB: RouteInfo[]): RouteInfo[] => {
    const uniquePaths = new Set<string>();
    const mergedRoutes: RouteInfo[] = [];
    
    // Process the first array
    routesA.forEach(route => {
      if (!uniquePaths.has(route.path)) {
        uniquePaths.add(route.path);
        mergedRoutes.push(route);
      }
    });
    
    // Process the second array
    routesB.forEach(route => {
      if (!uniquePaths.has(route.path)) {
        uniquePaths.add(route.path);
        mergedRoutes.push(route);
      }
    });
    
    return mergedRoutes;
  };

  // Setup presence channel for real-time user tracking
  useEffect(() => {
    if (!user) return;

    const enrichedUser = enrichProfileWithRoles(user);
    
    // Create presence channel for online users
    const channel = supabase.channel('online-users');
    
    // Define user presence data to track
    const presenceData: UserPresence = {
      id: user.id,
      first_name: enrichedUser.first_name || null,
      last_name: enrichedUser.last_name || null,
      avatar_url: enrichedUser.avatar_url || null,
      online_at: new Date().toISOString(),
    };
    
    // Set current user presence
    setCurrentUserPresence(presenceData);
    
    // Subscribe to presence events
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<UserPresence>();
        // Convert presence state to array of users
        const presentUsers: UserPresence[] = [];
        
        Object.values(state).forEach(userPresences => {
          if (userPresences && userPresences.length > 0) {
            presentUsers.push(...userPresences);
          }
        });
        
        console.log('Online users count:', presentUsers.length);
        setOnlineUsers(presentUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track the current user's presence
          await channel.track(presenceData);
        }
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPageVisibility();
      
      // If user is admin, sync pages on component mount
      if (user.role === 'admin') {
        syncAvailablePages();
      }
      
      // Set up interval to refresh presence periodically (every 5 minutes)
      let presenceInterval: number | undefined;
      presenceInterval = window.setInterval(() => {
        if (currentUserPresence) {
          const channel = supabase.channel('online-users');
          channel.track({
            ...currentUserPresence,
            online_at: new Date().toISOString(),
          });
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => {
        if (presenceInterval) clearInterval(presenceInterval);
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
        syncAvailablePages,
        onlineUsers,
        currentUserPresence
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
