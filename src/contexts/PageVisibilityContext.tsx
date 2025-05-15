
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { extractRoutes, extractRouteName, type RouteInfo } from '@/utils/routeUtils';
import { UserWithProfile } from '@/types/supabase';

type PageVisibility = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

type UserPresence = {
  user_id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  online_at: string;
  last_active_page?: string;
};

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

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);

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

  // Set up user presence tracking
  useEffect(() => {
    if (!user) return;

    // Clean up previous channel if it exists
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
    }

    // Create and subscribe to the presence channel
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Handle presence events (sync, join, leave)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presentUsers: UserPresence[] = [];
        
        // Convert presence state to array of users
        Object.entries(state).forEach(([key, presences]) => {
          const userPresence = presences[0] as any;
          if (userPresence) {
            presentUsers.push({
              user_id: key,
              first_name: userPresence.first_name || '',
              last_name: userPresence.last_name || '',
              avatar_url: userPresence.avatar_url,
              online_at: userPresence.online_at,
              last_active_page: userPresence.last_active_page
            });
          }
        });
        
        setOnlineUsers(presentUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      });

    // Subscribe to the channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Get user metadata
        const userData = user.user_metadata || {};
        
        // Extract first and last name, handling different data structures
        let firstName = '';
        let lastName = '';
        
        if (userData.first_name) {
          firstName = userData.first_name;
        } else if (userData.name) {
          const nameParts = userData.name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }
        
        // Track user's presence with profile information
        await channel.track({
          online_at: new Date().toISOString(),
          first_name: firstName,
          last_name: lastName,
          avatar_url: userData.avatar_url || '',
          last_active_page: location.pathname
        });
      }
    });

    setPresenceChannel(channel);
    
    // Update user's active page when location changes
    const updateActivePage = async () => {
      if (channel && user) {
        const userData = user.user_metadata || {};
        
        // Extract first and last name, handling different data structures
        let firstName = '';
        let lastName = '';
        
        if (userData.first_name) {
          firstName = userData.first_name;
        } else if (userData.name) {
          const nameParts = userData.name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }
        
        await channel.track({
          online_at: new Date().toISOString(),
          first_name: firstName,
          last_name: lastName,
          avatar_url: userData.avatar_url || '',
          last_active_page: location.pathname
        });
      }
    };

    // Update active page on location change
    updateActivePage();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, location.pathname]);

  useEffect(() => {
    if (user) {
      fetchPageVisibility();
      
      // If user is admin, sync pages
      // Handle user roles safely
      const isAdmin = (user.app_metadata?.roles || []).includes('admin') || 
                      (user.user_metadata?.role === 'admin');
      
      if (isAdmin) {
        syncAvailablePages();
      }
    } else {
      // Handle case when user is not authenticated
      setIsLoading(false);
      setPageVisibility([]);
    }
  }, [user]);

  const isPageVisible = (path: string): boolean => {
    // Admins can always see all pages
    // Handle user roles safely
    const isAdmin = (user?.app_metadata?.roles || []).includes('admin') || 
                    (user?.user_metadata?.role === 'admin');
    
    if (isAdmin) return true;

    // Find exact match or pattern match for the path
    const page = pageVisibility.find(p => 
      p.page_path === path || 
      (p.page_path.includes(':') && matchPathPattern(p.page_path, path))
    );

    if (!page) return true; // If page isn't in the visibility list, default to visible

    // Check user role and page visibility
    const isInstructor = (user?.app_metadata?.roles || []).includes('instructor') || 
                         (user?.user_metadata?.role === 'instructor');
    
    if (isInstructor) {
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
