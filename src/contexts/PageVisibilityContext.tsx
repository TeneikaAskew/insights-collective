
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import { resolveGoverningPaths, getAllManifestEntries } from '@/config/pageManifest';

const logger = createLogger('PageVisibilityContext');

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
   *   not ready yet => managed pages hidden (fail-closed)
   *   fetch failed  => managed pages hidden (fail-closed) — a DB/RLS failure
   *                    must not silently grant access to gated pages
   *
   * A URL is governed by its manifest chain (see pageManifest.ts): hiding
   * /courses hides /courses/:id/builder too, and a child page like
   * /interview-prep/star-practice needs BOTH /interview-prep and its own
   * entry visible.
   *
   * Fail-closed is scoped to MANAGED chains only: a path outside the
   * manifest (404s, redirect-only URLs, unmanaged surfaces) can never be
   * gated, so hiding it during loading/errors buys no security — it only
   * blanks pages the visibility system does not govern. Those return true
   * unconditionally (after the admin bypass).
   */
  const isPageVisible = useCallback((path: string): boolean => {
    // Admin users always see everything
    if (user?.roles?.includes('admin')) {
      return true;
    }

    const chain = resolveGoverningPaths(path);

    // Not a managed page — visible even while loading or on load error;
    // there is nothing to gate here.
    if (chain.length === 0) {
      return true;
    }

    // While data is still loading, hide managed pages (fail-closed)
    if (!isReady) {
      return false;
    }

    // If the visibility fetch failed, we cannot know which managed pages are
    // gated. Fail closed rather than defaulting them to visible.
    if (loadError) {
      return false;
    }

    const isInstructor = user?.roles?.includes('instructor');

    // Every governing path must be visible (a hidden parent hides the subtree)
    return chain.every(governingPath => {
      const entry = pageVisibility.find(page => page.page_path === governingPath);

      // Managed page without a DB row yet — default to visible
      if (!entry) {
        return true;
      }

      if (isInstructor) {
        return entry.visible_to_users || entry.visible_to_instructors;
      }
      return entry.visible_to_users;
    });
  }, [user?.roles, isReady, loadError, pageVisibility]);

  const updatePageVisibility = async (pageId: string, updates: Partial<PageVisibilityEntry>) => {
    // Optimistic: flip local state immediately (the moved switch IS the
    // success feedback — no toast on the happy path), revert on failure.
    let previous: PageVisibilityEntry | undefined;
    setPageVisibility(prev =>
      prev.map(page => {
        if (page.id !== pageId) return page;
        previous = page;
        return { ...page, ...updates };
      })
    );

    const revert = () => {
      const before = previous;
      if (!before) return;
      setPageVisibility(prev => prev.map(page => (page.id === pageId ? before : page)));
    };

    try {
      const { error } = await supabase
        .from('page_visibility')
        .update(updates)
        .eq('id', pageId);

      if (error) {
        logger.error('Error updating page visibility:', error);
        revert();
        toast({
          title: 'Error updating page visibility',
          description: error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error updating page visibility:', error);
      revert();
      toast({
        title: 'Error updating page visibility',
        description: 'Failed to update page visibility settings',
        variant: 'destructive',
      });
    }
  };

  /**
   * Reconcile the page_visibility table with the page manifest: upsert a
   * row for every canonical manifest entry, then remove rows whose path is
   * no longer in the manifest (dead routes, aliases, and surfaces that are
   * not visibility-gated — auth, legal, /admin). Stale rows are worse than
   * cosmetic: a row for a path the gate never matches is a toggle that
   * silently does nothing.
   */
  const syncAvailablePages = async () => {
    setIsSyncing(true);
    try {
      const availablePages = getAllManifestEntries();

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

      // Remove rows for paths the manifest no longer manages
      let removedCount = 0;
      const manifestPaths = new Set(availablePages.map(page => page.page_path));
      const { data: existingRows, error: staleFetchError } = await supabase
        .from('page_visibility')
        .select('id, page_path')
        .order('page_path');

      if (staleFetchError) {
        logger.error('Error fetching rows for stale-path cleanup:', staleFetchError);
      } else {
        const staleIds = (existingRows || [])
          .filter(row => !manifestPaths.has(row.page_path))
          .map(row => row.id);

        if (staleIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('page_visibility')
            .delete()
            .in('id', staleIds);

          if (deleteError) {
            logger.error('Error deleting stale page rows:', deleteError);
          } else {
            removedCount = staleIds.length;
          }
        }
      }

      await fetchPageVisibilityData();

      const removedNote = removedCount > 0 ? ` ${removedCount} stale entries removed.` : '';

      if (failedPages.length === availablePages.length) {
        toast({
          title: 'Page sync failed',
          description: `All ${availablePages.length} pages failed to sync. Check the console for details.`,
          variant: 'destructive',
        });
      } else if (failedPages.length > 0) {
        toast({
          title: 'Pages partially synced',
          description: `${availablePages.length - failedPages.length} of ${availablePages.length} pages synced; ${failedPages.length} failed (${failedPages.slice(0, 3).join(', ')}${failedPages.length > 3 ? ', …' : ''}).${removedNote}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pages synced successfully',
          description: `${availablePages.length} pages have been synchronized with the database.${removedNote}`,
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
    pageVisibility,
    updatePageVisibility,
    syncAvailablePages,
    isSyncing
  };

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
};
