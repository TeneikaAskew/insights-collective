import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioPage } from '@/types/portfolio';
import { useToast } from '@/hooks/use-toast';
import { isValidUUID } from '@/utils/idUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('usePortfolioPages');

export const usePortfolioPages = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all portfolio pages for the current user
  const {
    data: portfolioPages = [],
    isLoading: portfolioPagesLoading,
    error: portfolioPagesError,
    refetch: refetchPortfolioPages
  } = useQuery({
    queryKey: ['portfolio-pages'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_pages')
        .select(`
          *,
          portfolio_page_projects (
            *,
            project:portfolio_projects (*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(page => ({
        ...page,
        projects: page.portfolio_page_projects?.map(pp => ({
          ...pp,
          project: pp.project
        })) || []
      })) as unknown as PortfolioPage[];
    },
  });

  // Alternative name for loading state (for backward compatibility)
  const pagesLoading = portfolioPagesLoading;

  // Fetch a single portfolio page with projects
  const usePortfolioPageWithProjects = (pageId?: string) => {
    return useQuery({
      queryKey: ['portfolio-page', pageId],
      queryFn: async () => {
        if (!pageId) return null;
        // `id` is a uuid column, so a route param that is not a uuid can never
        // match — Postgres rejects it with 22P02 and the editor surfaced a
        // database error where it should have shown its not-found state.
        // Same guard the lesson and module hooks already use.
        if (!isValidUUID(pageId)) {
          logger.warn('Portfolio page id is not a UUID; skipping fetch', { pageId });
          return null;
        }

        // maybeSingle, not single: a page id that matches nothing is an
        // ordinary state the editor renders as not-found. `.single()` turned it
        // into a thrown PGRST116, which the route wrapper could not tell apart
        // from a network failure or an RLS refusal.
        const { data, error } = await supabase
          .from('portfolio_pages')
          .select(`
            *,
            portfolio_page_projects (
              *,
              project:portfolio_projects (*)
            )
          `)
          .eq('id', pageId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
          ...data,
          projects: data.portfolio_page_projects?.map((pp: any) => ({
            ...pp,
            project: pp.project
          })) || []
        } as PortfolioPage;
      },
      enabled: !!pageId,
    });
  };

  // Fetch a single portfolio page by ID or custom URL
  const getPortfolioPage = async (identifier: string): Promise<PortfolioPage | null> => {
    logger.log('getPortfolioPage called with identifier:', identifier);
    
    // First try to get by custom URL
    let { data, error } = await supabase
      .from('portfolio_pages')
      .select(`
        *,
        portfolio_page_projects (
          *,
          project:portfolio_projects (*)
        )
      `)
      .eq('custom_url', identifier)
      .eq('is_public', true)
      .maybeSingle();

    logger.log('Query by custom_url result:', { data, error });

    // If not found by custom URL, try by ID — but only when the identifier is
    // actually a UUID. portfolio_pages.id is a uuid column, so querying it
    // with an arbitrary slug raised Postgres 22P02 and every mistyped public
    // URL surfaced as an error instead of a clean not-found.
    if (!data && !error && isValidUUID(identifier)) {
      logger.log('Trying to fetch by ID:', identifier);
      ({ data, error } = await supabase
        .from('portfolio_pages')
        .select(`
          *,
          portfolio_page_projects (
            *,
            project:portfolio_projects (*)
          )
        `)
        .eq('id', identifier)
        .eq('is_public', true)
        .maybeSingle());
      
      logger.log('Query by ID result:', { data, error });
    }

    if (error) {
      logger.error('getPortfolioPage error:', error);
      throw error;
    }
    
    if (!data) {
      logger.log('No portfolio data found for identifier:', identifier);
      return null;
    }

    const result = {
      ...data,
      projects: data.portfolio_page_projects?.map((pp: any) => ({
        ...pp,
        project: pp.project
      })) || []
    } as PortfolioPage;

    logger.log('getPortfolioPage final result:', result);
    logger.log('getPortfolioPage projects count:', result.projects?.length);
    
    return result;
  };

  // Get public portfolio page (for public viewing)
  const getPublicPortfolioPage = async (identifier: string): Promise<PortfolioPage | null> => {
    logger.log('getPublicPortfolioPage called with:', identifier);
    const result = await getPortfolioPage(identifier);
    logger.log('getPublicPortfolioPage returning:', result);
    return result;
  };

  // Create a new portfolio page
  const createPortfolioPage = useMutation({
    mutationFn: async (portfolioPage: Omit<PortfolioPage, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // One page per account. The unique constraint is the real guarantee, but
      // reaching it produces a 23505 the caller would surface as "Failed to
      // create portfolio page" — accurate and useless. Refusing here says why.
      const { count, error: countError } = await supabase
        .from('portfolio_pages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error('You already have a portfolio page. Edit that one instead of creating another.');
      }

      const { data, error } = await supabase
        .from('portfolio_pages')
        .insert({
          ...portfolioPage,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      toast({
        title: "Success",
        description: "Portfolio page created successfully!",
      });
    },
    onError: (error) => {
      logger.error('Error creating portfolio page:', error);
      toast({
        title: "Could not create your portfolio page",
        // The thrown message when a second page is refused explains itself;
        // a fixed "Failed to create portfolio page" would have replaced it
        // with something the reader can do nothing about.
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: "destructive"
      });
    }
  });

  // Alternative name for create mutation (for backward compatibility)
  const addPortfolioPage = createPortfolioPage;

  // Update a portfolio page
  const updatePortfolioPage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortfolioPage> & { id: string }) => {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
    },
    onError: (error) => {
      logger.error('Error updating portfolio page:', error);
      throw error;
    }
  });

  // Add project to portfolio page
  const addProjectToPortfolio = useMutation({
    mutationFn: async ({ portfolioPageId, projectId, customDescription }: {
      portfolioPageId: string;
      projectId: string;
      customDescription?: string;
    }) => {
      // Get the current highest display order
      const { data: existingProjects, error: orderError } = await supabase
        .from('portfolio_page_projects')
        .select('display_order')
        .eq('portfolio_page_id', portfolioPageId)
        .order('display_order', { ascending: false })
        .limit(1);

      if (orderError) throw orderError;

      const nextDisplayOrder = existingProjects && existingProjects.length > 0 
        ? existingProjects[0].display_order + 1 
        : 0;

      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .insert({
          portfolio_page_id: portfolioPageId,
          project_id: projectId,
          display_order: nextDisplayOrder,
          custom_description: customDescription,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
      toast({
        title: "Success",
        description: "Project added to portfolio!",
      });
    },
    onError: (error) => {
      logger.error('Error adding project to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add project to portfolio",
        variant: "destructive"
      });
    }
  });

  // Alternative method name for adding projects
  const addProjectToPage = useMutation({
    mutationFn: async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
      return addProjectToPortfolio.mutateAsync({
        portfolioPageId: pageId,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
    },
  });

  // Remove project from portfolio page
  const removeProjectFromPortfolio = useMutation({
    mutationFn: async ({ portfolioPageId, projectId }: {
      portfolioPageId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from('portfolio_page_projects')
        .delete()
        .eq('portfolio_page_id', portfolioPageId)
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
      toast({
        title: "Success",
        description: "Project removed from portfolio!",
      });
    },
    onError: (error) => {
      logger.error('Error removing project from portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to remove project from portfolio",
        variant: "destructive"
      });
    }
  });

  // Alternative method name for removing projects
  const removeProjectFromPage = useMutation({
    mutationFn: async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
      return removeProjectFromPortfolio.mutateAsync({
        portfolioPageId: pageId,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
    },
  });

  // Update portfolio page project
  const updatePortfolioPageProject = useMutation({
    mutationFn: async ({ 
      pageId, 
      projectId, 
      customDescription, 
      displayOrder 
    }: {
      pageId: string;
      projectId: string;
      customDescription?: string;
      displayOrder?: number;
    }) => {
      const updates: any = {};
      if (customDescription !== undefined) updates.custom_description = customDescription;
      if (displayOrder !== undefined) updates.display_order = displayOrder;

      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .update(updates)
        .eq('portfolio_page_id', pageId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page'] });
    },
    onError: (error) => {
      logger.error('Error updating portfolio page project:', error);
      throw error;
    }
  });

  // Export portfolio as CSV
  const exportPortfolioAsCSV = async (portfolioPageId: string) => {
    const portfolioPage = portfolioPages.find(p => p.id === portfolioPageId);
    if (!portfolioPage) throw new Error('Portfolio page not found');

    const csvContent = generateCSVContent(portfolioPage);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${portfolioPage.title.replace(/\s+/g, '_')}_portfolio.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate shareable link
  const getShareableLink = (customUrlOrId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/portfolio/${customUrlOrId}`;
  };

  return {
    portfolioPages,
    portfolioPagesLoading,
    pagesLoading, // backward compatibility
    portfolioPagesError,
    refetchPortfolioPages,
    usePortfolioPageWithProjects,
    getPortfolioPage,
    getPublicPortfolioPage,
    createPortfolioPage,
    addPortfolioPage, // backward compatibility
    updatePortfolioPage,
    addProjectToPortfolio,
    addProjectToPage,
    removeProjectFromPortfolio,
    removeProjectFromPage,
    updatePortfolioPageProject,
    exportPortfolioAsCSV,
    getShareableLink,
  };
};

// Helper function to generate CSV content
const generateCSVContent = (portfolioPage: PortfolioPage): string => {
  const headers = ['Project Title', 'Description', 'Required Skills', 'Effort Level', 'Impact', 'Status', 'GitHub URL', 'Live URL'];
  const rows = portfolioPage.projects?.map(projectItem => {
    const project = projectItem.project;
    if (!project) return [];
    
    return [
      project.title || '',
      projectItem.custom_description || project.description || '',
      project.required_skills?.join('; ') || '',
      project.effort_level || '',
      project.impact || '',
      project.status || '',
      project.github_url || '',
      project.live_url || ''
    ];
  }) || [];

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
};
