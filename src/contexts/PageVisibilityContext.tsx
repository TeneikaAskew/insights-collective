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

type PageVisibilityContextType = {
  isVisible: boolean;
  onlineUsers: PresenceUser[];
  currentUserPresence: PresenceUser | null;
};

const PageVisibilityContext = createContext<PageVisibilityContextType>({
  isVisible: true,
  onlineUsers: [],
  currentUserPresence: null,
});

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<PresenceUser | null>(null);
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

  // Set up real-time presence
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const presenceChannel = supabase.channel('online-users');
    setChannel(presenceChannel);

    // Subscribe to the channel first
    const subscription = presenceChannel.subscribe((status) => {
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

    channel.on('presence', { event: 'sync' }, handleSync);
    channel.on('presence', { event: 'join' }, handleJoin);
    channel.on('presence', { event: 'leave' }, handleLeave);

    return () => {
      if (channel) {
        channel.off('presence', { event: 'sync' }, handleSync);
        channel.off('presence', { event: 'join' }, handleJoin);
        channel.off('presence', { event: 'leave' }, handleLeave);
      }
    };
  }, [channel, isSubscribed, user]);

  // Regular heartbeat to keep presence active
  useEffect(() => {
    if (!isAuthenticated || !user || !channel || !isSubscribed) return;

    const heartbeatInterval = setInterval(() => {
      if (isSubscribed) {
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

  return (
    <PageVisibilityContext.Provider value={{ isVisible, onlineUsers, currentUserPresence }}>
      {children}
    </PageVisibilityContext.Provider>
  );
};

export const usePageVisibility = () => useContext(PageVisibilityContext);
