
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioPage, PortfolioPageProject } from '@/types/portfolio';
import { useToast } from '@/hooks/use-toast';

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
            project:projects (*)
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
      })) as PortfolioPage[];
    },
  });

  // Fetch a single portfolio page by ID or custom URL
  const getPortfolioPage = async (identifier: string): Promise<PortfolioPage | null> => {
    // First try to get by custom URL
    let { data, error } = await supabase
      .from('portfolio_pages')
      .select(`
        *,
        portfolio_page_projects (
          *,
          project:projects (*)
        )
      `)
      .eq('custom_url', identifier)
      .eq('is_public', true)
      .maybeSingle();

    // If not found by custom URL, try by ID
    if (!data && !error) {
      ({ data, error } = await supabase
        .from('portfolio_pages')
        .select(`
          *,
          portfolio_page_projects (
            *,
            project:projects (*)
          )
        `)
        .eq('id', identifier)
        .eq('is_public', true)
        .maybeSingle());
    }

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      projects: data.portfolio_page_projects?.map((pp: any) => ({
        ...pp,
        project: pp.project
      })) || []
    } as PortfolioPage;
  };

  // Create a new portfolio page
  const createPortfolioPage = useMutation({
    mutationFn: async (portfolioPage: Omit<PortfolioPage, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_pages')
        .insert({
          ...portfolioPage,
          user_id: user.id,
        })
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
      console.error('Error creating portfolio page:', error);
      toast({
        title: "Error",
        description: "Failed to create portfolio page",
        variant: "destructive"
      });
    }
  });

  // Update a portfolio page
  const updatePortfolioPage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortfolioPage> & { id: string }) => {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
    },
    onError: (error) => {
      console.error('Error updating portfolio page:', error);
      throw error;
    }
  });

  // Delete a portfolio page
  const deletePortfolioPage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolio_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      toast({
        title: "Success",
        description: "Portfolio page deleted successfully!",
      });
    },
    onError: (error) => {
      console.error('Error deleting portfolio page:', error);
      toast({
        title: "Error",
        description: "Failed to delete portfolio page",
        variant: "destructive"
      });
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
      const { data: existingProjects } = await supabase
        .from('portfolio_page_projects')
        .select('display_order')
        .eq('portfolio_page_id', portfolioPageId)
        .order('display_order', { ascending: false })
        .limit(1);

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
      toast({
        title: "Success",
        description: "Project added to portfolio!",
      });
    },
    onError: (error) => {
      console.error('Error adding project to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add project to portfolio",
        variant: "destructive"
      });
    }
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
      toast({
        title: "Success",
        description: "Project removed from portfolio!",
      });
    },
    onError: (error) => {
      console.error('Error removing project from portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to remove project from portfolio",
        variant: "destructive"
      });
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
    portfolioPagesError,
    refetchPortfolioPages,
    getPortfolioPage,
    createPortfolioPage,
    updatePortfolioPage,
    deletePortfolioPage,
    addProjectToPortfolio,
    removeProjectFromPortfolio,
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
