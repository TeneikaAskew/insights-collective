
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OnlineUser {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface CurrentUserPresence {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface PageVisibilityEntry {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
}

interface PageVisibilityContextType {
  isPageVisible: (path: string) => boolean;
  isLoading: boolean;
  onlineUsers: OnlineUser[];
  currentUserPresence: CurrentUserPresence | null;
  pageVisibility: PageVisibilityEntry[];
  updatePageVisibility: (pageId: string, updates: Partial<PageVisibilityEntry>) => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  isSyncing: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    // Return default values when context is not available to prevent blocking
    console.warn('[PageVisibilityContext] Context not found, returning conservative defaults');
    return {
      isPageVisible: () => false, // Default to hidden for safety
      isLoading: true, // Indicate we're still loading
      onlineUsers: [] as OnlineUser[],
      currentUserPresence: null,
      pageVisibility: [] as PageVisibilityEntry[],
      updatePageVisibility: async () => {},
      syncAvailablePages: async () => {},
      isSyncing: false
    };
  }
  return context;
};

interface PageVisibilityProviderProps {
  children: ReactNode;
}

export const PageVisibilityProvider: React.FC<PageVisibilityProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<CurrentUserPresence | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch page visibility data on mount
  useEffect(() => {
    fetchPageVisibilityData();
  }, []);

  // Set current user presence when user changes
  useEffect(() => {
    if (user?.user_metadata) {
      setCurrentUserPresence({
        first_name: user.user_metadata.first_name,
        last_name: user.user_metadata.last_name,
        avatar_url: user.user_metadata.avatar_url
      });
    }
  }, [user]);

  const fetchPageVisibilityData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('page_visibility')
        .select('*')
        .order('page_path');

      if (error) {
        console.error('Error fetching page visibility data:', error);
        toast({
          title: 'Error loading page visibility',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setPageVisibility(data || []);
    } catch (error) {
      console.error('Error fetching page visibility data:', error);
      toast({
        title: 'Error loading page visibility',
        description: 'Failed to load page visibility settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isPageVisible = (path: string): boolean => {
    console.log(`[PageVisibilityProvider] Checking visibility for path: ${path}`);
    console.log(`[PageVisibilityProvider] Current pageVisibility data:`, pageVisibility);
    console.log(`[PageVisibilityProvider] User roles:`, user?.roles);
    console.log(`[PageVisibilityProvider] isLoading:`, isLoading);
    
    // Admin users can see all pages
    if (user?.roles?.includes('admin')) {
      console.log(`[PageVisibilityProvider] Admin user, showing all pages`);
      return true;
    }
    
    // If data is still loading, hide pages by default (except admin)
    if (isLoading || pageVisibility.length === 0) {
      console.log(`[PageVisibilityProvider] Data still loading or empty, hiding ${path} by default`);
      return false;
    }
    
    // Find the page visibility entry for this path
    const pageEntry = pageVisibility.find(page => page.page_path === path);
    console.log(`[PageVisibilityProvider] Found page entry for ${path}:`, pageEntry);
    
    if (!pageEntry) {
      console.log(`[PageVisibilityProvider] No page entry found for ${path}, defaulting to visible`);
      return true; // Default to visible if not in database but data is loaded
    }
    
    // Check user roles and page visibility settings
    const isInstructor = user?.roles?.includes('instructor');
    const isRegularUser = !isInstructor && !user?.roles?.includes('admin');
    
    console.log(`[PageVisibilityProvider] Page ${path}, isInstructor: ${isInstructor}, isRegularUser: ${isRegularUser}`);
    console.log(`[PageVisibilityProvider] Page settings - visible_to_users: ${pageEntry.visible_to_users}, visible_to_instructors: ${pageEntry.visible_to_instructors}`);
    
    // Determine visibility based on role
    if (isInstructor) {
      const visible = pageEntry.visible_to_instructors;
      console.log(`[PageVisibilityProvider] Instructor visibility result for ${path}: ${visible}`);
      return visible;
    } else if (isRegularUser) {
      const visible = pageEntry.visible_to_users;
      console.log(`[PageVisibilityProvider] Regular user visibility result for ${path}: ${visible}`);
      return visible;
    }
    
    // Default to visible for any other case
    console.log(`[PageVisibilityProvider] Default visibility for ${path}: true`);
    return true;
  };

  const updatePageVisibility = async (pageId: string, updates: Partial<PageVisibilityEntry>) => {
    try {
      const { error } = await supabase
        .from('page_visibility')
        .update(updates)
        .eq('id', pageId);

      if (error) {
        console.error('Error updating page visibility:', error);
        toast({
          title: 'Error updating page visibility',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setPageVisibility(prev => 
        prev.map(page => 
          page.id === pageId ? { ...page, ...updates } : page
        )
      );

      toast({
        title: 'Page visibility updated',
        description: 'Page visibility settings have been saved successfully.',
      });
    } catch (error) {
      console.error('Error updating page visibility:', error);
      toast({
        title: 'Error updating page visibility',
        description: 'Failed to update page visibility settings',
        variant: 'destructive',
      });
    }
  };

  const syncAvailablePages = async () => {
    setIsSyncing(true);
    try {
      // Define all available pages from the codebase
      const availablePages = [
        // Core Routes
        { page_path: '/', page_name: 'Home' },
        { page_path: '/dashboard', page_name: 'Dashboard' },
        { page_path: '/user-dashboard', page_name: 'User Dashboard' },
        { page_path: '/notifications', page_name: 'Notifications' },
        { page_path: '/calendar', page_name: 'Calendar' },
        
        // Authentication Routes
        { page_path: '/login', page_name: 'Login' },
        { page_path: '/register', page_name: 'Register' },
        { page_path: '/reset-password', page_name: 'Reset Password' },
        { page_path: '/auth-callback', page_name: 'Auth Callback' },
        
        // Profile & User Routes
        { page_path: '/profile', page_name: 'Profile' },
        
        // Course & Learning Routes
        { page_path: '/courses', page_name: 'Courses' },
        { page_path: '/course-list', page_name: 'Course List' },
        
        // Interview Preparation Routes
        { page_path: '/interview-prep', page_name: 'Interview Prep' },
        { page_path: '/interview-prep/code-practice', page_name: 'Interview Code Practice' },
        { page_path: '/interview-prep/job-description', page_name: 'Job Description Analysis' },
        { page_path: '/interview-prep/mock-interview-room', page_name: 'Mock Interview Room' },
        { page_path: '/interview-prep/mock-interviews', page_name: 'Mock Interviews' },
        { page_path: '/interview-prep/star-practice', page_name: 'STAR Practice' },
        { page_path: '/mock-interviews', page_name: 'Mock Interviews' },
        { page_path: '/code-practice', page_name: 'Code Practice' },
        
        // Career & AI Routes
        { page_path: '/career-agent', page_name: 'Career Agent' },
        { page_path: '/career-pathway', page_name: 'Career Pathway' },
        { page_path: '/assistants', page_name: 'AI Assistants' },
        { page_path: '/explore-data-careers', page_name: 'Explore Data Careers' },
        { page_path: '/resume', page_name: 'Resume Analyzer' },
        
        // Events & Social Routes
        { page_path: '/events', page_name: 'Events' },
        { page_path: '/messages', page_name: 'Messages' },
        { page_path: '/forum', page_name: 'Forum' },
        { page_path: '/forums', page_name: 'Forums' },
        
        // Portfolio Routes
        { page_path: '/portfolio-explorer', page_name: 'Portfolio Explorer' },
        
        // Blog & Content Routes
        { page_path: '/data-blueprint-series', page_name: 'Data Blueprint Series' },
        { page_path: '/create-blog-post', page_name: 'Create Blog Post' },
        
        // Resources & Tools Routes
        { page_path: '/resources', page_name: 'Resources' },
        { page_path: '/teneika-linkedin', page_name: "Teneika's LinkedIn" },
        { page_path: '/teneika-tweets', page_name: "Teneika's Tweets" },
        
        // Survey & Forms Routes
        { page_path: '/survey', page_name: 'AI & Automation Fellowship' },
        { page_path: '/survey-confirmation', page_name: 'Survey Confirmation' },
        
        // Admin Routes
        { page_path: '/admin', page_name: 'Admin Dashboard' },
        { page_path: '/admin/activity', page_name: 'Admin Activity' },
        { page_path: '/admin/blog-posts', page_name: 'Admin Blog Posts' },
        { page_path: '/admin/courses', page_name: 'Admin Courses' },
        { page_path: '/admin/events', page_name: 'Admin Events' },
        { page_path: '/admin/forms', page_name: 'Admin Forms' },
        { page_path: '/admin/users', page_name: 'Admin Users' },
        { page_path: '/admin/page-visibility', page_name: 'Admin Page Visibility' },
        { page_path: '/admin/form-management', page_name: 'Admin Form Management' },
        { page_path: '/admin/unified-form-management', page_name: 'Admin Unified Form Management' },
        { page_path: '/admin/local-storage-debug', page_name: 'Admin Debug Tools' },
        
        // Legal & Info Routes
        { page_path: '/privacy-policy', page_name: 'Privacy Policy' },
        { page_path: '/terms-of-service', page_name: 'Terms of Service' }
      ];

      console.log('Syncing pages to database:', availablePages);

      // Upsert all pages into the database
      for (const page of availablePages) {
        const { error } = await supabase
          .from('page_visibility')
          .upsert({
            page_path: page.page_path,
            page_name: page.page_name,
            visible_to_users: true, // Default to visible for new pages
            visible_to_instructors: true
          }, {
            onConflict: 'page_path',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Error upserting page ${page.page_path}:`, error);
        }
      }
      
      // Re-fetch the updated page visibility data
      await fetchPageVisibilityData();
      
      toast({
        title: 'Pages synced successfully',
        description: `${availablePages.length} pages have been synchronized with the database.`,
      });
    } catch (error) {
      console.error('[PageVisibilityProvider] Error syncing pages:', error);
      toast({
        title: 'Error syncing pages',
        description: 'Failed to sync page visibility data',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const value = {
    isPageVisible,
    isLoading,
    onlineUsers,
    currentUserPresence,
    pageVisibility,
    updatePageVisibility,
    syncAvailablePages,
    isSyncing
  };

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
};
