import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
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

// Define types for user profile data
type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

// Cache for user profiles
const userProfileCache = new Map<string, UserProfile>();

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
  isOnline: boolean;
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
  isOnline: true,
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
  const [isOnline, setIsOnline] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<PresenceUser | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const [channel, setChannel] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 5000;

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    // Check cache first
    if (userProfileCache.has(userId)) {
      return userProfileCache.get(userId)!;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        // Cache the profile
        userProfileCache.set(userId, data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  }, []);

  // Create user profile object with data from profiles table
  const createUserProfile = useCallback(async (userId: string): Promise<Partial<PresenceUser>> => {
    const profile = await fetchUserProfile(userId);
    return {
      id: userId,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      avatar_url: profile?.avatar_url || null,
      online_at: new Date().toISOString(),
    };
  }, [fetchUserProfile]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowVisible = document.visibilityState === 'visible';
      setIsVisible(isNowVisible);
      
      // Sync presence on tab focus
      if (isNowVisible && channel && isSubscribed && user) {
        createUserProfile(user.id).then(userProfile => {
          channel.track(userProfile)
            .catch(err => console.error('Error refreshing presence on focus:', err));
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [channel, isSubscribed, user, createUserProfile]);

  // Handle online/offline status
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setIsVisible(false);
    };
    
    const handleOnline = () => {
      setIsOnline(true);
      setIsVisible(true);
      // Attempt to reconnect presence channel
      if (channel && !isSubscribed) {
        channel.subscribe();
      }
    };
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [channel, isSubscribed]);

  // Update the reconnection logic
  const attemptReconnect = useCallback(async () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
    console.log(`Attempting to reconnect in ${delay}ms...`);

    try {
      if (channel) {
        await channel.unsubscribe();
        setIsSubscribed(false);
        
        // Wait for the exponential backoff delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Create a new channel instance instead of reusing the old one
        const newChannel = supabase.channel('online-users', {
          config: {
            presence: {
              key: user?.id,
            },
          },
        });
        
        setChannel(newChannel);
        await newChannel.subscribe();
        setReconnectAttempts(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error during reconnection:', error);
      // Schedule next reconnection attempt
      setTimeout(attemptReconnect, delay);
    }
  }, [channel, reconnectAttempts, user]);

  // Update the real-time presence setup effect
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let presenceChannel: any = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const setupChannel = async () => {
      if (presenceChannel) {
        await presenceChannel.unsubscribe();
      }

      presenceChannel = supabase.channel('online-users', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      setChannel(presenceChannel);

      const handleError = async (error: any) => {
        console.error('Presence channel error:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          await attemptReconnect();
        } else {
          console.error('Max reconnection attempts reached');
          // Reset reconnection attempts after a longer delay
          setTimeout(() => {
            setReconnectAttempts(0);
            setupChannel();
          }, RECONNECT_DELAY * 10);
        }
      };

      presenceChannel.subscribe(async (status: string) => {
        console.info('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          setReconnectAttempts(0);

          try {
            // Track presence after successfully subscribed
            const userProfile = await createUserProfile(user.id);
            await presenceChannel.track(userProfile);
            console.info('Presence tracking started');
          } catch (err) {
            console.error('Error tracking presence:', err);
            handleError(err);
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsSubscribed(false);
          handleError(new Error(`Channel status: ${status}`));
        }
      });

      // Set up presence event handlers with error handling
      presenceChannel.on('presence', { event: 'sync' }, () => {
        try {
          const newState = presenceChannel.presenceState();
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
        } catch (error) {
          console.error('Error handling presence sync:', error);
        }
      });

      presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: PresenceUser[] }) => {
        try {
          console.info('User joined:', newPresences);
          setOnlineUsers(prev => {
            const filtered = prev.filter(user => !newPresences.some(p => p.id === user.id));
            return [...filtered, ...newPresences];
          });
        } catch (error) {
          console.error('Error handling presence join:', error);
        }
      });

      presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string; leftPresences: PresenceUser[] }) => {
        try {
          console.info('User left:', leftPresences);
          setOnlineUsers(prev => 
            prev.filter(user => !leftPresences.some(left => left.id === user.id))
          );
        } catch (error) {
          console.error('Error handling presence leave:', error);
        }
      });
    };

    // Initial setup
    setupChannel();

    // Cleanup function
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (presenceChannel) {
        presenceChannel.unsubscribe();
        setChannel(null);
        setIsSubscribed(false);
      }
    };
  }, [isAuthenticated, user, createUserProfile, reconnectAttempts, attemptReconnect]);

  // Regular heartbeat to keep presence active
  useEffect(() => {
    if (!isAuthenticated || !user || !channel || !isSubscribed) return;

    const heartbeatInterval = setInterval(async () => {
      if (isSubscribed && channel) {
        const userProfile = await createUserProfile(user.id);
        channel.track(userProfile)
          .catch(err => console.error('Error refreshing presence:', err));
      }
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [isAuthenticated, user, channel, isSubscribed, createUserProfile]);

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
        isOnline, 
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
