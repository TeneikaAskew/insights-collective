
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PortfolioPage, PortfolioPageProject, PortfolioTheme } from '@/types/portfolio';

export function usePortfolioPages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch portfolio pages
  const { data: portfolioPages, isLoading: pagesLoading } = useQuery({
    queryKey: ['portfolio-pages', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('Fetching portfolio pages for user:', user.id);

      const { data, error } = await supabase
        .from('portfolio_pages')
        .select(`
          *,
          portfolio_page_projects (
            *,
            portfolio_projects (*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching portfolio pages:', error);
        throw error;
      }
      
      console.log('Fetched portfolio pages:', data);
      return data as PortfolioPage[];
    },
    enabled: !!user,
  });

  // Fetch a single portfolio page with projects
  const usePortfolioPageWithProjects = (pageId: string) => {
    return useQuery({
      queryKey: ['portfolio-page', pageId],
      queryFn: async () => {
        if (!user) throw new Error('User not authenticated');

        console.log('Fetching single portfolio page:', pageId);

        const { data, error } = await supabase
          .from('portfolio_pages')
          .select(`
            *,
            portfolio_page_projects (
              *,
              portfolio_projects (*)
            )
          `)
          .eq('id', pageId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching portfolio page:', error);
          throw error;
        }
        
        console.log('Fetched portfolio page with projects:', data);
        return data as PortfolioPage;
      },
      enabled: !!user && !!pageId,
    });
  };

  // Get public portfolio page
  const getPublicPortfolioPage = async (customUrl: string) => {
    const { data, error } = await supabase
      .from('portfolio_pages')
      .select(`
        *,
        portfolio_page_projects (
          *,
          portfolio_projects (*)
        )
      `)
      .eq('custom_url', customUrl)
      .eq('is_public', true)
      .single();

    if (error) throw error;
    return data as PortfolioPage;
  };

  // Add portfolio page
  const addPortfolioPage = useMutation({
    mutationFn: async (pageData: {
      title: string;
      description?: string;
      theme: PortfolioTheme;
      is_public: boolean;
      custom_url?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('portfolio_pages')
        .insert({
          ...pageData,
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
        description: "Portfolio page created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create portfolio page.",
        variant: "destructive",
      });
    },
  });

  // Update portfolio page
  const updatePortfolioPage = useMutation({
    mutationFn: async (pageData: {
      id: string;
      title?: string;
      description?: string;
      theme?: PortfolioTheme;
      layout?: string;
      is_public?: boolean;
      custom_url?: string;
      profile_data?: any;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { id, ...updateData } = pageData;
      const { data, error } = await supabase
        .from('portfolio_pages')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
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
        description: "Portfolio page updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update portfolio page.",
        variant: "destructive",
      });
    },
  });

  // Delete portfolio page
  const deletePortfolioPage = useMutation({
    mutationFn: async (pageId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('portfolio_pages')
        .delete()
        .eq('id', pageId)
        .eq('user_id', user.id);

      if (error) throw error;
      return pageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      toast({
        title: "Success",
        description: "Portfolio page deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete portfolio page.",
        variant: "destructive",
      });
    },
  });

  // Add project to portfolio page
  const addProjectToPage = useMutation({
    mutationFn: async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
      if (!user) throw new Error('User not authenticated');

      console.log('Adding project to page mutation:', { pageId, projectId, userId: user.id });

      // Check if project is already in this portfolio - use maybeSingle() instead of single()
      const { data: existingProject } = await supabase
        .from('portfolio_page_projects')
        .select('id')
        .eq('portfolio_page_id', pageId)
        .eq('project_id', projectId)
        .maybeSingle();

      if (existingProject) {
        console.log('Project already exists in portfolio');
        throw new Error('Project is already in this portfolio');
      }

      // Get the highest display order for this portfolio
      const { data: maxOrderData } = await supabase
        .from('portfolio_page_projects')
        .select('display_order')
        .eq('portfolio_page_id', pageId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrderData?.display_order || 0) + 1;

      console.log('Inserting portfolio page project with order:', nextOrder);

      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .insert({
          portfolio_page_id: pageId,
          project_id: projectId,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting portfolio page project:', error);
        throw error;
      }
      
      console.log('Successfully inserted portfolio page project:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Project added successfully, invalidating queries');
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', variables.pageId] });
      
      // Also refetch the data immediately
      queryClient.refetchQueries({ queryKey: ['portfolio-pages', user?.id] });
      
      toast({
        title: "Success",
        description: "Project added to portfolio successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error in addProjectToPage mutation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add project to portfolio.",
        variant: "destructive",
      });
    },
  });

  // Remove project from portfolio page
  const removeProjectFromPage = useMutation({
    mutationFn: async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
      if (!user) throw new Error('User not authenticated');

      console.log('Removing project from page:', { pageId, projectId });

      const { error } = await supabase
        .from('portfolio_page_projects')
        .delete()
        .eq('portfolio_page_id', pageId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error removing project from page:', error);
        throw error;
      }
      
      console.log('Successfully removed project from page');
      return { pageId, projectId };
    },
    onSuccess: (data) => {
      console.log('Project removed successfully, invalidating queries');
      
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', data.pageId] });
      
      // Also refetch the data immediately
      queryClient.refetchQueries({ queryKey: ['portfolio-pages', user?.id] });
      
      toast({
        title: "Success",
        description: "Project removed from portfolio successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error in removeProjectFromPage mutation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove project from portfolio.",
        variant: "destructive",
      });
    },
  });

  // Update portfolio page project
  const updatePortfolioPageProject = useMutation({
    mutationFn: async ({ 
      pageId, 
      projectId, 
      displayOrder, 
      customDescription 
    }: { 
      pageId: string; 
      projectId: string; 
      displayOrder?: number; 
      customDescription?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const updateData: any = {};
      if (displayOrder !== undefined) updateData.display_order = displayOrder;
      if (customDescription !== undefined) updateData.custom_description = customDescription;

      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .update(updateData)
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project in portfolio.",
        variant: "destructive",
      });
    },
  });

  // Export portfolio as CSV
  const exportPortfolioAsCSV = async (pageId: string) => {
    try {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .select(`
          *,
          portfolio_page_projects (
            *,
            portfolio_projects (*)
          )
        `)
        .eq('id', pageId)
        .single();

      if (error) throw error;

      // Create CSV content
      const csvContent = [
        ['Project Title', 'Description', 'Skills', 'Status', 'GitHub URL', 'Live URL'],
        ...(data.portfolio_page_projects || []).map((item: any) => [
          item.portfolio_projects?.title || '',
          item.portfolio_projects?.description || '',
          item.portfolio_projects?.required_skills?.join(', ') || '',
          item.portfolio_projects?.status || '',
          item.portfolio_projects?.github_url || '',
          item.portfolio_projects?.live_url || '',
        ])
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title || 'portfolio'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Portfolio exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export portfolio.",
        variant: "destructive",
      });
    }
  };

  // Get shareable link
  const getShareableLink = (customUrl: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/portfolio/${customUrl}`;
  };

  return {
    portfolioPages,
    pagesLoading,
    usePortfolioPageWithProjects,
    getPublicPortfolioPage,
    addPortfolioPage,
    updatePortfolioPage,
    deletePortfolioPage,
    addProjectToPage,
    removeProjectFromPage,
    updatePortfolioPageProject,
    exportPortfolioAsCSV,
    getShareableLink,
  };
}
