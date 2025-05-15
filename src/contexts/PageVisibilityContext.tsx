
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { extractAllRoutes, extractConfigRoutes, type RouteInfo } from '@/utils/routeUtils';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

type PageVisibility = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

interface UserPresence {
  user_id: string;
  name?: string;
  avatar_url?: string;
  last_active: string;
  current_path?: string;
}

type PageVisibilityContextType = {
  pageVisibility: PageVisibility[];
  isLoading: boolean;
  isPageVisible: (path: string) => boolean;
  updatePageVisibility: (id: string, updates: Partial<PageVisibility>) => Promise<void>;
  refreshPageVisibility: () => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  onlineUsers: UserPresence[];
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
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
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

  // This function will sync available routes with the page_visibility table
  const syncAvailablePages = async () => {
    try {
      // Get all existing routes from the DOM-rendered routes
      const rootElement = document.querySelector('#root')?.firstElementChild;
      if (!rootElement) {
        console.error('Could not find routes in DOM');
        return;
      }
      
      // Extract all routes including nested ones
      const availableRoutes = extractAllRoutes(rootElement as any);
      
      // Also extract routes from sidebar/navbar configs if they exist
      const sidebarElements = document.querySelectorAll('[data-sidebar="menu-button"]');
      const navbarElements = document.querySelectorAll('nav a');
      
      // Extract hrefs from sidebar and navbar elements
      const navRoutes: RouteInfo[] = [];
      
      sidebarElements.forEach((el: Element) => {
        const link = el.closest('a');
        if (link && link.getAttribute('href') && !link.getAttribute('href')?.startsWith('#')) {
          const path = link.getAttribute('href') || '';
          navRoutes.push({
            path,
            name: link.textContent?.trim() || getPageNameFromPath(path)
          });
        }
      });
      
      navbarElements.forEach((link: Element) => {
        if (link.getAttribute('href') && !link.getAttribute('href')?.startsWith('#')) {
          const path = link.getAttribute('href') || '';
          navRoutes.push({
            path,
            name: link.textContent?.trim() || getPageNameFromPath(path)
          });
        }
      });
      
      // Combine all routes and remove duplicates
      const allRoutes = [...availableRoutes, ...navRoutes];
      const uniqueRoutes = Array.from(new Set(allRoutes.map(r => r.path)))
        .map(path => {
          const route = allRoutes.find(r => r.path === path);
          return route!;
        });
      
      console.log('All detected routes:', uniqueRoutes);

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
      const routesToAdd = uniqueRoutes.filter(route => !existingPathsSet.has(route.path));

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
      } else {
        console.log('No new routes to add to visibility table');
      }
    } catch (error) {
      console.error('Error in syncAvailablePages:', error);
    }
  };

  // Setup presence channel for real-time user presence
  useEffect(() => {
    if (!user) return;
    
    // Create presence channel
    const presenceChannel = supabase.channel('online-users');

    // Subscribe to presence changes
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        
        // Convert presence state to array of user info
        const usersOnline: UserPresence[] = [];
        
        Object.entries(state).forEach(([userId, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            // Get the first presence for each user (most recent)
            const presence = presences[0] as any;
            
            if (presence.user_info) {
              usersOnline.push({
                user_id: userId,
                name: presence.user_info.name || undefined,
                avatar_url: presence.user_info.avatar_url || undefined,
                last_active: presence.last_active || new Date().toISOString(),
                current_path: presence.current_path
              });
            }
          }
        });
        
        setOnlineUsers(usersOnline);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track own presence after successful subscription
          const userInfo = {
            name: user.name,
            avatar_url: user.avatar
          };
          
          // Track user's presence
          await presenceChannel.track({
            user_id: user.id,
            user_info: userInfo,
            last_active: new Date().toISOString(),
            current_path: location.pathname
          });
        }
      });
    
    // Update current path when location changes
    useEffect(() => {
      if (presenceChannel && user) {
        const userInfo = {
          name: user.name,
          avatar_url: user.avatar
        };
        
        presenceChannel.track({
          user_id: user.id,
          user_info: userInfo,
          last_active: new Date().toISOString(),
          current_path: location.pathname
        });
      }
    }, [location.pathname]);
    
    return () => {
      // Unsubscribe when component unmounts
      supabase.removeChannel(presenceChannel);
    };
  }, [user, location.pathname]);

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
        syncAvailablePages,
        onlineUsers
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
