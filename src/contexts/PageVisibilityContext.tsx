
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

// Define types for presence data
type PresenceUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  online_at: string;
  presence_ref: string;
};

// Define the type for page visibility data
type PageVisibilityData = {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

// Define context type with all required properties
type PageVisibilityContextType = {
  isVisible: boolean;
  onlineUsers: PresenceUser[];
  currentUserPresence: PresenceUser | null;
  // Add the following properties needed by PageVisibilityGuard and AdminPageVisibility
  isPageVisible: (path: string) => boolean;
  isLoading: boolean;
  pageVisibility: PageVisibilityData[];
  updatePageVisibility: (id: string, updates: Partial<PageVisibilityData>) => Promise<void>;
  syncAvailablePages: () => Promise<void>;
};

const PageVisibilityContext = createContext<PageVisibilityContextType>({
  isVisible: true,
  onlineUsers: [],
  currentUserPresence: null,
  isPageVisible: () => true,
  isLoading: true,
  pageVisibility: [],
  updatePageVisibility: async () => {},
  syncAvailablePages: async () => {},
});

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<PresenceUser | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const [channel, setChannel] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch page visibility data
  useEffect(() => {
    const fetchPageVisibility = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('page_visibility')
          .select('*');
        
        if (error) throw error;
        setPageVisibility(data || []);
      } catch (error) {
        console.error('Error fetching page visibility:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPageVisibility();
  }, []);

  // Set up real-time presence
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const presenceChannel = supabase.channel('online-users');
    setChannel(presenceChannel);

    // Subscribe to the channel first
    presenceChannel.subscribe((status) => {
      console.info('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        setIsSubscribed(true);

        // Only track presence after successfully subscribed
        const userProfile = {
          id: user.id,
          first_name: user?.user_metadata?.first_name || null,
          last_name: user?.user_metadata?.last_name || null,
          avatar_url: user?.user_metadata?.avatar_url || null,
          online_at: new Date().toISOString(),
        };
        
        presenceChannel.track(userProfile)
          .then(() => console.info('Presence tracking started'))
          .catch(err => console.error('Error tracking presence:', err));
      }
    });

    return () => {
      if (presenceChannel) {
        presenceChannel.unsubscribe();
        setChannel(null);
        setIsSubscribed(false);
      }
    };
  }, [isAuthenticated, user]);

  // Set up presence event handlers after subscription
  useEffect(() => {
    if (!channel || !isSubscribed) return;

    const handleSync = () => {
      const newState = channel.presenceState();
      const allUsers: PresenceUser[] = [];
      
      Object.keys(newState).forEach(key => {
        newState[key].forEach((presence: PresenceUser) => {
          allUsers.push(presence);
          if (presence.id === user?.id) {
            setCurrentUserPresence(presence);
          }
        });
      });
      
      setOnlineUsers(allUsers);
      console.info('Online users count:', allUsers.length);
    };

    const handleJoin = ({ key, newPresences }: { key: string; newPresences: PresenceUser[] }) => {
      console.info('User joined:', newPresences);
      setOnlineUsers(prev => {
        // Remove any existing entries for these users
        const filtered = prev.filter(user => !newPresences.some(p => p.id === user.id));
        // Add the new presences
        return [...filtered, ...newPresences];
      });
    };

    const handleLeave = ({ key, leftPresences }: { key: string; leftPresences: PresenceUser[] }) => {
      console.info('User left:', leftPresences);
      setOnlineUsers(prev => 
        prev.filter(user => !leftPresences.some(left => left.id === user.id))
      );
    };

    // Use the on method to set up event handlers instead of off
    channel.on('presence', { event: 'sync' }, handleSync);
    channel.on('presence', { event: 'join' }, handleJoin);
    channel.on('presence', { event: 'leave' }, handleLeave);

    return () => {
      // Fixed: Don't use channel.off which doesn't exist, use unsubscribe instead
      // The cleanup is already handled in the previous useEffect
      // We don't need to manually remove listeners as unsubscribe does this
    };
  }, [channel, isSubscribed, user]);

  // Regular heartbeat to keep presence active
  useEffect(() => {
    if (!isAuthenticated || !user || !channel || !isSubscribed) return;

    const heartbeatInterval = setInterval(() => {
      if (isSubscribed && channel) {
        const userProfile = {
          id: user.id,
          first_name: user?.user_metadata?.first_name || null,
          last_name: user?.user_metadata?.last_name || null,
          avatar_url: user?.user_metadata?.avatar_url || null,
          online_at: new Date().toISOString(),
        };
        
        channel.track(userProfile)
          .catch(err => console.error('Error refreshing presence:', err));
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [isAuthenticated, user, channel, isSubscribed]);

  // Check if a page is visible based on user role
  const isPageVisible = (path: string): boolean => {
    if (!user) return true; // Default to visible if no user (for public pages)
    
    const isAdmin = user.user_metadata?.role === 'admin' || 
                   (Array.isArray(user.user_metadata?.roles) && 
                    user.user_metadata?.roles.includes('admin'));
    
    if (isAdmin) return true; // Admins can see everything
    
    const isInstructor = user.user_metadata?.role === 'instructor' || 
                        (Array.isArray(user.user_metadata?.roles) && 
                         user.user_metadata?.roles.includes('instructor'));
    
    const pageConfig = pageVisibility.find(p => {
      // For dynamic routes with parameters, we need to match the pattern
      if (p.page_path.includes(':')) {
        const pathPattern = p.page_path.replace(/:\w+/g, '[^/]+');
        const regex = new RegExp(`^${pathPattern}$`);
        return regex.test(path);
      }
      return p.page_path === path;
    });
    
    if (!pageConfig) return true; // Default to visible if no config found
    
    return isInstructor ? pageConfig.visible_to_instructors : pageConfig.visible_to_users;
  };

  // Update page visibility
  const updatePageVisibility = async (id: string, updates: Partial<PageVisibilityData>) => {
    const { error } = await supabase
      .from('page_visibility')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    
    // Update local state
    setPageVisibility(prev => 
      prev.map(page => page.id === id ? { ...page, ...updates } : page)
    );
  };

  // Sync available pages with the database
  // Fixed: Change return type to Promise<void> instead of returning data
  const syncAvailablePages = async (): Promise<void> => {
    try {
      // Typically this would involve scanning routes and updating the database
      // For now, we'll just refetch the data
      const { data, error } = await supabase
        .from('page_visibility')
        .select('*');
      
      if (error) throw error;
      setPageVisibility(data || []);
      // Don't return data here to match Promise<void> return type
    } catch (error) {
      console.error('Error syncing available pages:', error);
      throw error;
    }
  };

  return (
    <PageVisibilityContext.Provider 
      value={{ 
        isVisible, 
        onlineUsers, 
        currentUserPresence,
        isPageVisible,
        isLoading,
        pageVisibility,
        updatePageVisibility,
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
