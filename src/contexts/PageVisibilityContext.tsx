
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';

const logger = createLogger('PageVisibilityContext');

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
  /** True once auth state AND page visibility data have both resolved at least once */
  isReady: boolean;
  /** True when the page-visibility fetch failed; isPageVisible fails CLOSED for non-admins in this state */
  loadError: boolean;
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
    logger.warn('Context not found, returning conservative defaults');
    return {
      isPageVisible: () => false,
      isLoading: true,
      isReady: false,
      loadError: false,
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [dataLoading, setDataLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<CurrentUserPresence | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Derived: system is "ready" when both auth and page-visibility data have resolved
  const isReady = !authLoading && dataFetched;
  const isLoading = !isReady;

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
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('page_visibility')
        .select('*')
        .order('page_path');

      if (error) {
        // BEHAVIOR CHANGE (silent-failure audit): previously a failed fetch left
        // pageVisibility empty and marked the system "ready", which made every
        // managed page default to VISIBLE (fail-open access control). We now
        // record the failure, surface it, and isPageVisible fails CLOSED for
        // non-admins until a successful fetch.
        logger.error('Error fetching page visibility data:', error);
        setLoadError(true);
        toast({
          title: 'Error loading page visibility settings',
          description: 'Access-controlled pages are hidden until settings can be loaded.',
          variant: 'destructive',
        });
        return;
      }

      setPageVisibility(data || []);
      setLoadError(false);
    } catch (error) {
      logger.error('Error fetching page visibility data:', error);
      setLoadError(true);
      toast({
        title: 'Error loading page visibility settings',
        description: 'Access-controlled pages are hidden until settings can be loaded.',
        variant: 'destructive',
      });
    } finally {
      setDataLoading(false);
      setDataFetched(true);
    }
  };

  /**
   * Visibility rules:
   *   admin     => always visible
   *   instructor => visible_to_users OR visible_to_instructors
   *   regular user => visible_to_users
   *   no entry in DB => default visible
   *   not ready yet => hidden (fail-closed)
   *   fetch failed  => hidden (fail-closed) — a DB/RLS failure must not
   *                    silently grant access to gated pages
   */
  const isPageVisible = useCallback((path: string): boolean => {
    // Admin users always see everything
    if (user?.roles?.includes('admin')) {
      return true;
    }

    // While data is still loading, hide managed pages (fail-closed)
    if (!isReady) {
      return false;
    }

    // If the visibility fetch failed, we cannot know which pages are gated.
    // Fail closed rather than defaulting everything to visible.
    if (loadError) {
      return false;
    }

    // Find the page visibility entry for this path
    const pageEntry = pageVisibility.find(page => page.page_path === path);

    // If the page is not in the visibility table, default to visible
    if (!pageEntry) {
      return true;
    }

    const isInstructor = user?.roles?.includes('instructor');

    // Instructor: visible if "All Users" OR "Instructors" is on
    if (isInstructor) {
      return pageEntry.visible_to_users || pageEntry.visible_to_instructors;
    }

    // Regular signed-in user (student): visible only if "All Users" is on
    return pageEntry.visible_to_users;
  }, [user?.roles, isReady, loadError, pageVisibility]);

  const updatePageVisibility = async (pageId: string, updates: Partial<PageVisibilityEntry>) => {
    try {
      const { error } = await supabase
        .from('page_visibility')
        .update(updates)
        .eq('id', pageId);

      if (error) {
        logger.error('Error updating page visibility:', error);
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
      logger.error('Error updating page visibility:', error);
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
      const availablePages = [
        { page_path: '/', page_name: 'Home' },
        { page_path: '/dashboard', page_name: 'Dashboard' },
        { page_path: '/user-dashboard', page_name: 'User Dashboard' },
        { page_path: '/notifications', page_name: 'Notifications' },
        { page_path: '/calendar', page_name: 'Calendar' },
        { page_path: '/login', page_name: 'Login' },
        { page_path: '/register', page_name: 'Register' },
        { page_path: '/reset-password', page_name: 'Reset Password' },
        { page_path: '/auth-callback', page_name: 'Auth Callback' },
        { page_path: '/profile', page_name: 'Profile' },
        { page_path: '/courses', page_name: 'Courses' },
        { page_path: '/course-list', page_name: 'Course List' },
        { page_path: '/interview-prep', page_name: 'Interview Prep' },
        { page_path: '/interview-prep/code-practice', page_name: 'Interview Code Practice' },
        { page_path: '/interview-prep/job-description', page_name: 'Job Description Analysis' },
        { page_path: '/interview-prep/mock-interview-room', page_name: 'Mock Interview Room' },
        { page_path: '/interview-prep/mock-interviews', page_name: 'Mock Interviews' },
        { page_path: '/interview-prep/star-practice', page_name: 'STAR Practice' },
        { page_path: '/mock-interviews', page_name: 'Mock Interviews' },
        { page_path: '/code-practice', page_name: 'Code Practice' },
        { page_path: '/career-agent', page_name: 'Career Agent' },
        { page_path: '/career-pathway', page_name: 'Career Pathway' },
        { page_path: '/assistants', page_name: 'AI Assistants' },
        { page_path: '/explore-data-careers', page_name: 'Explore Data Careers' },
        { page_path: '/resume', page_name: 'Resume Analyzer' },
        { page_path: '/events', page_name: 'Events' },
        { page_path: '/messages', page_name: 'Messages' },
        { page_path: '/forum', page_name: 'Forum' },
        { page_path: '/forums', page_name: 'Forums' },
        { page_path: '/portfolio-explorer', page_name: 'Portfolio Explorer' },
        { page_path: '/create-blog-post', page_name: 'Create Blog Post' },
        { page_path: '/resources', page_name: 'Resources' },
        { page_path: '/teneika-linkedin', page_name: "Teneika's LinkedIn" },
        { page_path: '/teneika-tweets', page_name: "Teneika's Tweets" },
        { page_path: '/survey', page_name: 'AI & Automation Fellowship' },
        { page_path: '/survey-confirmation', page_name: 'Survey Confirmation' },
        { page_path: '/admin', page_name: 'Admin Dashboard' },
        { page_path: '/admin/activity', page_name: 'Admin Activity' },
        { page_path: '/admin/blog-posts', page_name: 'Admin Blog Posts' },
        { page_path: '/admin/courses', page_name: 'Admin Courses' },
        { page_path: '/admin/events', page_name: 'Admin Events' },
        { page_path: '/admin/users', page_name: 'Admin Users' },
        { page_path: '/admin/page-visibility', page_name: 'Admin Page Visibility' },
        { page_path: '/admin/unified-form-management', page_name: 'Form Management' },
        { page_path: '/admin/local-storage-debug', page_name: 'Admin Debug Tools' },
        { page_path: '/privacy-policy', page_name: 'Privacy Policy' },
        { page_path: '/terms-of-service', page_name: 'Terms of Service' }
      ];

      logger.log('Syncing pages to database:', availablePages);

      // BEHAVIOR CHANGE (silent-failure audit): per-page upsert failures were
      // logged and then reported as a full success ("N pages synchronized").
      // We now count failures and report honest numbers.
      const failedPages: string[] = [];
      for (const page of availablePages) {
        const { error } = await supabase
          .from('page_visibility')
          .upsert({
            page_path: page.page_path,
            page_name: page.page_name,
            visible_to_users: true,
            visible_to_instructors: true
          }, {
            onConflict: 'page_path',
            ignoreDuplicates: true
          });

        if (error) {
          logger.error(`Error upserting page ${page.page_path}:`, error);
          failedPages.push(page.page_path);
        }
      }

      await fetchPageVisibilityData();

      if (failedPages.length === availablePages.length) {
        toast({
          title: 'Page sync failed',
          description: `All ${availablePages.length} pages failed to sync. Check the console for details.`,
          variant: 'destructive',
        });
      } else if (failedPages.length > 0) {
        toast({
          title: 'Pages partially synced',
          description: `${availablePages.length - failedPages.length} of ${availablePages.length} pages synced; ${failedPages.length} failed (${failedPages.slice(0, 3).join(', ')}${failedPages.length > 3 ? ', …' : ''}).`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pages synced successfully',
          description: `${availablePages.length} pages have been synchronized with the database.`,
        });
      }
    } catch (error) {
      logger.error('Error syncing pages:', error);
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
    isReady,
    loadError,
    onlineUsers,
    currentUserPresence,
    pageVisibility,
    updatePageVisibility,
    syncAvailablePages,
    isSyncing
  };

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
};
