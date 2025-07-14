
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
    console.warn('[PageVisibilityContext] Context not found, returning default visibility');
    return {
      isPageVisible: () => true, // Default to visible
      isLoading: false,
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
    
    // Admin users can see all pages
    if (user?.roles?.includes('admin')) {
      console.log(`[PageVisibilityProvider] Admin user, showing all pages`);
      return true;
    }
    
    // Find the page visibility entry for this path
    const pageEntry = pageVisibility.find(page => page.page_path === path);
    console.log(`[PageVisibilityProvider] Found page entry for ${path}:`, pageEntry);
    
    if (!pageEntry) {
      console.log(`[PageVisibilityProvider] No page entry found for ${path}, defaulting to visible`);
      return true; // Default to visible if not in database
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
      // Re-fetch the current page visibility data
      await fetchPageVisibilityData();
      
      toast({
        title: 'Pages synced',
        description: 'Page visibility data has been refreshed successfully.',
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
