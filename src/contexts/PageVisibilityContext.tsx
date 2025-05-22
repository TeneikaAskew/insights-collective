
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { extractRoutes } from '@/utils/routeUtils';
import { useLocation } from 'react-router-dom';

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
  userRole: string | null;
  isSyncing: boolean;
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
  userRole: null,
  isSyncing: false,
});

export const PageVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<PresenceUser | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [channel, setChannel] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const location = useLocation();

  // Get user role from auth context and profile
  const userRole = user?.roles && user.roles.length > 0 
    ? user.roles[0] 
    : user?.user_metadata?.role || null;

  console.log('User role from auth context:', userRole);
  console.log('User data:', user);

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
        console.log('Fetched page visibility data:', data);
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
      const uniqueUsers = new Map<string, PresenceUser>();
      
      Object.keys(newState).forEach(key => {
        newState[key].forEach((presence: PresenceUser) => {
          // Only keep the most recent presence for each user
          if (!uniqueUsers.has(presence.id) || 
              new Date(presence.online_at) > new Date(uniqueUsers.get(presence.id)!.online_at)) {
            uniqueUsers.set(presence.id, presence);
          }
          if (presence.id === user?.id) {
            setCurrentUserPresence(presence);
          }
        });
      });
      
      const allUsers: PresenceUser[] = Array.from(uniqueUsers.values());
      setOnlineUsers(allUsers);
      console.info('Online users count:', allUsers.length);
    };

    const handleJoin = ({ key, newPresences }: { key: string; newPresences: PresenceUser[] }) => {
      console.info('User joined:', newPresences);
      setOnlineUsers(prev => {
        const uniqueUsers = new Map();
        
        // Add existing users to map
        prev.forEach(user => uniqueUsers.set(user.id, user));
        
        // Update or add new presences
        newPresences.forEach(presence => {
          if (!uniqueUsers.has(presence.id) || 
              new Date(presence.online_at) > new Date(uniqueUsers.get(presence.id)!.online_at)) {
            uniqueUsers.set(presence.id, presence);
          }
        });
        
        return Array.from(uniqueUsers.values());
      });
    };

    const handleLeave = ({ key, leftPresences }: { key: string; leftPresences: PresenceUser[] }) => {
      console.info('User left:', leftPresences);
      setOnlineUsers(prev => {
        const uniqueUsers = new Map(prev.map(user => [user.id, user]));
        
        // Remove users who left
        leftPresences.forEach(presence => {
          uniqueUsers.delete(presence.id);
        });
        
        return Array.from(uniqueUsers.values());
      });
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
    
    console.log('Checking visibility for path:', path);
    console.log('Current user role:', userRole);
    
    // Admins can see everything
    if (userRole === 'admin') {
      console.log('User is admin, allowing access');
      return true;
    }
    
    // Check if the path matches any of the configured pages
    const pageConfig = pageVisibility.find(p => {
      // For dynamic routes with parameters, we need to match the pattern
      if (p.page_path.includes(':')) {
        const pathPattern = p.page_path.replace(/:\w+/g, '[^/]+');
        const regex = new RegExp(`^${pathPattern}$`);
        return regex.test(path);
      }
      return p.page_path === path;
    });
    
    console.log('Found page config:', pageConfig);
    
    // If no configuration found, default to visible
    if (!pageConfig) return true;
    
    // Check visibility based on user role
    const isVisible = userRole === 'instructor' 
      ? pageConfig.visible_to_instructors 
      : pageConfig.visible_to_users;
      
    console.log('Page visibility decision:', isVisible);
    return isVisible;
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
    
    console.log(`Updated visibility for page ${id}:`, updates);
  };

  // Improved sync available pages function to detect and add new routes
  const syncAvailablePages = async (): Promise<void> => {
    try {
      setIsSyncing(true);
      console.log('Starting page sync operation');
      
      // Extract routes from App.tsx using the React Router route configuration
      let appRoutes = [
        { path: '/', name: 'Home' },
        { path: '/login', name: 'Login' },
        { path: '/register', name: 'Register' },
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/profile', name: 'Profile' },
        { path: '/resources', name: 'Resources' },
        { path: '/events', name: 'Events' },
        { path: '/resume', name: 'Resume' },
        { path: '/messages', name: 'Messages' },
        { path: '/courses', name: 'Courses' },
        { path: '/course/:courseId', name: 'Course Detail' },
        { path: '/module/:moduleId', name: 'Module Detail' },
        { path: '/career-pathway', name: 'Career Pathway' },
        { path: '/calendar', name: 'Calendar' },
        { path: '/notifications', name: 'Notifications' },
        { path: '/assistants', name: 'Assistants' },
        { path: '/assistant/:assistantId', name: 'Assistant Chat' },
        { path: '/career-agent', name: 'Career Agent' },
        { path: '/interview-prep', name: 'Interview Prep' },
        { path: '/interview-prep/job-description', name: 'Job Description Analysis' },
        { path: '/interview-prep/star-practice', name: 'STAR Practice' },
        { path: '/interview-prep/code-practice', name: 'Code Practice (Interview)' },
        { path: '/interview-prep/mock-interviews', name: 'Mock Interviews' },
        { path: '/interview-prep/mock-interview-room/:sessionId', name: 'Mock Interview Room' },
        { path: '/mock-interviews', name: 'Mock Interviews' },
        { path: '/mock-interview/:sessionId', name: 'Mock Interview Session' },
        { path: '/code-practice', name: 'Code Practice' },
        { path: '/blog', name: 'Blog' },
        { path: '/blog/:postId', name: 'Blog Post' },
        { path: '/forums', name: 'Forums' },
        { path: '/forums/:forumId', name: 'Forum Detail' },
        { path: '/explore-data-careers', name: 'Explore Data Careers' },
        { path: '/admin', name: 'Admin Dashboard' },
        { path: '/admin/users', name: 'Admin Users' },
        { path: '/admin/courses', name: 'Admin Courses' },
        { path: '/admin/events', name: 'Admin Events' },
        { path: '/admin/page-visibility', name: 'Page Visibility' },
        { path: '/admin/resources', name: 'Admin Resources' },
        { path: '/admin/forms', name: 'Admin Forms' },
        { path: '/admin/activity', name: 'Admin Activity' },
        { path: '/admin/certificates', name: 'Admin Certificates' },
        { path: '/admin/blog-posts', name: 'Admin Blog Posts' },
        { path: '/admin/enrollments', name: 'Admin Enrollments' },
        { path: '/admin/course/:courseId/edit', name: 'Admin Course Edit' },
      ];
      
      console.log('App routes to sync:', appRoutes.length);
      
      // Get existing pages from database
      const { data: existingPages, error } = await supabase
        .from('page_visibility')
        .select('*');
      
      if (error) throw error;
      
      console.log('Existing pages in database:', existingPages?.length || 0);
      
      // Find new routes that don't exist in the database
      const existingPaths = new Set(existingPages?.map(p => p.page_path) || []);
      const newRoutes = appRoutes.filter(route => !existingPaths.has(route.path));
      
      console.log('New routes to add:', newRoutes.length);
      
      // Add new routes to database
      if (newRoutes.length > 0) {
        const newPages = newRoutes.map(route => ({
          page_path: route.path,
          page_name: route.name,
          visible_to_users: true, // Default to visible
          visible_to_instructors: true, // Default to visible
        }));
        
        const { error: insertError } = await supabase
          .from('page_visibility')
          .insert(newPages);
          
        if (insertError) throw insertError;
        
        console.log('Successfully added new pages:', newPages.length);
      }
      
      // Refetch all pages
      const { data: updatedPages, error: refetchError } = await supabase
        .from('page_visibility')
        .select('*');
        
      if (refetchError) throw refetchError;
      
      console.log('Updated pages list:', updatedPages?.length || 0);
      setPageVisibility(updatedPages || []);
      
      return;
    } catch (error) {
      console.error('Error syncing available pages:', error);
      throw error;
    } finally {
      setIsSyncing(false);
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
        syncAvailablePages,
        userRole,
        isSyncing
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
