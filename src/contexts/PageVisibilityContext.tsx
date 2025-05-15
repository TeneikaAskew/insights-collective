
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { extractRoutes, type RouteInfo } from '@/utils/routeUtils';

type PageVisibility = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

type OnlineUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_seen: string;
};

type PageVisibilityContextType = {
  pageVisibility: PageVisibility[];
  isLoading: boolean;
  isPageVisible: (path: string) => boolean;
  updatePageVisibility: (id: string, updates: Partial<PageVisibility>) => Promise<void>;
  refreshPageVisibility: () => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  onlineUsers: OnlineUser[];
};

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

// Helper function to match paths with parameters like /courses/:courseId
const matchPathPattern = (pattern: string, path: string): boolean => {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, i) => 
    part.startsWith(':') || part === pathParts[i]
  );
};

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // This hook must be used inside AuthProvider
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Fetch page visibility settings from the database
  const fetchPageVisibility = useCallback(async () => {
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
  }, []);

  // Setup presence channel to track online users
  const setupPresenceChannel = useCallback(() => {
    if (!user) return null;
    
    const channel = supabase.channel('online_users');
    
    const userStatus = {
      user_id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      avatar_url: user.avatar_url || '',
      online_at: new Date().toISOString(),
    };
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presentUsers: OnlineUser[] = [];
        
        Object.entries(state).forEach(([, presences]) => {
          const presenceArray = presences as any[];
          presenceArray.forEach(presence => {
            if (presence.user_id) {
              presentUsers.push({
                id: presence.user_id,
                first_name: presence.first_name,
                last_name: presence.last_name,
                avatar_url: presence.avatar_url,
                last_seen: presence.online_at,
              });
            }
          });
        });
        
        setOnlineUsers(presentUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userStatus);
        }
      });
      
    return channel;
  }, [user]);

  // This function will sync available routes with the page_visibility table
  const syncAvailablePages = useCallback(async () => {
    try {
      // Get all existing routes using the utility function
      const rootElement = document.querySelector('#root')?.firstElementChild as Element;
      if (!rootElement || !rootElement.children) {
        console.error('Could not find routes in DOM');
        return;
      }
      
      const availableRoutes = extractRoutes(Array.from(rootElement.children) as any);
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
  }, [fetchPageVisibility]);

  useEffect(() => {
    if (user) {
      fetchPageVisibility();
      
      // Set up presence channel
      const presenceChannel = setupPresenceChannel();
      
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
        if (presenceChannel) supabase.removeChannel(presenceChannel);
      };
    } else {
      // Handle case when user is not authenticated
      setIsLoading(false);
      setPageVisibility([]);
    }
  }, [user, fetchPageVisibility, syncAvailablePages, setupPresenceChannel]);

  const isPageVisible = useCallback((path: string): boolean => {
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
  }, [pageVisibility, user]);

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
