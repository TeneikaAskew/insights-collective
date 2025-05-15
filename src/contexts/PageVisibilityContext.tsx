import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { extractRoutes } from '@/utils/routeUtils';
import { useNavigate } from 'react-router-dom';

// Add these type definitions at the top of the file
interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  id: string;
  last_seen: string;
}

interface UserWithProfile {
  id: string;
  profile?: UserProfile;
  // Add other user properties as needed
}

// Add this function to safely extract user profile data
const extractUserProfile = (user: UserWithProfile): UserProfile => {
  return {
    id: user.id,
    first_name: user.profile?.first_name || null,
    last_name: user.profile?.last_name || null,
    avatar_url: user.profile?.avatar_url || null,
    last_seen: new Date().toISOString(),
  };
};

interface PageVisibilityContextType {
  pageVisibility: PageVisibility[];
  isPageVisible: (path: string) => boolean;
  isLoading: boolean;
  updatePageVisibility: (id: string, updates: Partial<PageVisibility>) => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  onlineUsers: UserProfile[];
}

interface PageVisibility {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, user } = useAuth();
  const [pageVisibility, setPageVisibility] = useState<PageVisibility[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch initial page visibility settings
  useEffect(() => {
    const fetchPageVisibility = async () => {
      setIsLoading(true);
      try {
        if (!session) {
          console.warn('No session found, skipping page visibility fetch.');
          return;
        }

        const { data, error } = await supabase
          .from('page_visibility')
          .select('*');

        if (error) {
          console.error("Error fetching page visibility:", error);
        } else {
          setPageVisibility(data || []);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPageVisibility();
  }, [session]);

  // Fetch available routes on component mount
  useEffect(() => {
    // Delay the import to avoid issues during server-side rendering
    import('../App').then((module) => {
      const appRoutes = module.default?.();
      if (appRoutes && appRoutes.props && appRoutes.props.children) {
        const routes = extractRoutes(React.Children.toArray(appRoutes.props.children));
        const paths = routes.map(route => route.path);
        setAvailableRoutes(paths);
      } else {
        console.warn("Could not extract routes from App component.");
      }
    }).catch(error => {
      console.error("Error importing App component:", error);
    });
  }, []);

  // Realtime presence tracking
  useEffect(() => {
    if (!session) {
      console.log('No session, cannot initialize presence');
      return;
    }

    let channel = supabase.channel('online_users', { config: { presence: { key: user?.id } } })

    channel.on('presence', { event: 'sync' }, async () => {
      const presenceState = channel.presenceState();
      console.log('Presence sync:', presenceState);

      // Extract user IDs from presence state
      const userIds = Object.keys(presenceState);

      if (userIds.length === 0) {
        setOnlineUsers([]);
        return;
      }

      // Fetch user profiles in a single query
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, last_seen')
        .in('id', userIds);

      if (error) {
        console.error('Error fetching user profiles:', error);
        return;
      }

      // Format user data for the presence tracking
      const formattedUsers = profiles.map(profile => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        last_seen: new Date().toISOString(),
      }));

      setOnlineUsers(formattedUsers);
    });

    channel.on('presence', { event: 'join' }, async ({ key }) => {
      console.log('User joined:', key);
      // Fetch the profile of the user who joined
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, last_seen')
        .eq('id', key)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      // Format user data for presence tracking
      const userPresence = {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        last_seen: new Date().toISOString(),
      };

      setOnlineUsers(prevUsers => [...prevUsers, userPresence]);
    });

    channel.on('presence', { event: 'leave' }, async ({ key }) => {
      console.log('User left:', key);
      setOnlineUsers(prevUsers => prevUsers.filter(u => u.id !== key));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presence = channel.track({ user_id: user?.id, online_at: new Date().toISOString() });
        console.log('Presence tracked:', presence);
      }
    });

    return () => {
      console.log('Unsubscribing from presence channel');
      channel.unsubscribe();
    };
  }, [session, user?.id]);

  const isPageVisible = useCallback((path: string) => {
    if (!session) {
      console.warn('No session, cannot determine page visibility. Defaulting to false.');
      return false;
    }

    if (user?.user_metadata?.role === 'admin') {
      return true; // Admins can see all pages
    }

    const page = pageVisibility.find(p => p.page_path === path);

    if (!page) {
      console.warn(`No visibility setting found for path: ${path}. Defaulting to false.`);
      return false; // Default to not visible if no setting is found
    }

    if (user?.user_metadata?.role === 'instructor') {
      return page.visible_to_instructors;
    }

    return page.visible_to_users; // Default for regular users
  }, [session, user?.user_metadata?.role, pageVisibility]);

  const updatePageVisibility = async (id: string, updates: Partial<PageVisibility>) => {
    try {
      const { error } = await supabase
        .from('page_visibility')
        .update(updates)
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Optimistically update the local state
      setPageVisibility(prev =>
        prev.map(page => (page.id === id ? { ...page, ...updates } : page))
      );
    } catch (error) {
      console.error("Error updating page visibility:", error);
      throw error;
    }
  };

  const syncAvailablePages = async () => {
    if (!session) {
      console.warn('No session, cannot sync available pages.');
      return;
    }

    if (!availableRoutes) {
      console.warn('No available routes to sync.');
      return;
    }

    try {
      // Fetch existing page visibility settings
      const { data: existingPages, error: fetchError } = await supabase
        .from('page_visibility')
        .select('page_path');

      if (fetchError) {
        throw fetchError;
      }

      const existingPaths = existingPages?.map(page => page.page_path) || [];

      // Identify new routes that are not yet in the page visibility settings
      const newRoutes = availableRoutes.filter(route => !existingPaths.includes(route));

      if (newRoutes.length === 0) {
        console.log('No new routes to add.');
        return;
      }

      // Prepare the new page visibility entries
      const newPageVisibilityEntries = newRoutes.map(route => ({
        page_path: route,
        page_name: extractRouteName(route),
        visible_to_users: false, // Default to not visible
        visible_to_instructors: false, // Default to not visible
      }));

      // Insert the new entries into the database
      const { error: insertError } = await supabase
        .from('page_visibility')
        .insert(newPageVisibilityEntries);

      if (insertError) {
        throw insertError;
      }

      // Update local state with the new entries
      setPageVisibility(prev => [...prev, ...newPageVisibilityEntries]);
    } catch (error) {
      console.error("Error syncing available pages:", error);
      throw error;
    }
  };

  const value: PageVisibilityContextType = {
    pageVisibility,
    isPageVisible,
    isLoading,
    updatePageVisibility,
    syncAvailablePages,
    onlineUsers,
  };

  return (
    <PageVisibilityContext.Provider value={value}>
      {children}
    </PageVisibilityContext.Provider>
  );
};

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    throw new Error("usePageVisibility must be used within a PageVisibilityProvider");
  }
  return context;
};
