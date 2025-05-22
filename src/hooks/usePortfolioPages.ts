
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PortfolioPage, PortfolioPageProject, PortfolioProject } from '@/types/portfolio';

export function usePortfolioPages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's portfolio pages
  const { data: portfolioPages, isLoading: pagesLoading, error: pagesError } = useQuery({
    queryKey: ['portfolio-pages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('portfolio_pages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data as PortfolioPage[];
    },
    enabled: !!user?.id,
  });

  // Fetch a specific portfolio page with its projects
  const fetchPortfolioPageWithProjects = async (pageId: string) => {
    if (!user?.id) return null;

    // First get the page details
    const { data: pageData, error: pageError } = await supabase
      .from('portfolio_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (pageError) throw new Error(pageError.message);

    // Then get all the projects for this page
    const { data: pageProjectsData, error: projectsError } = await supabase
      .from('portfolio_page_projects')
      .select(`
        id,
        portfolio_page_id,
        project_id,
        display_order,
        custom_description,
        project:project_id (*)
      `)
      .eq('portfolio_page_id', pageId)
      .order('display_order', { ascending: true });

    if (projectsError) throw new Error(projectsError.message);

    return {
      ...pageData,
      projects: pageProjectsData as PortfolioPageProject[],
    };
  };

  // Get portfolio page by ID with its projects
  const usePortfolioPageWithProjects = (pageId?: string) => {
    return useQuery({
      queryKey: ['portfolio-page', pageId],
      queryFn: () => fetchPortfolioPageWithProjects(pageId!),
      enabled: !!pageId && !!user?.id,
    });
  };

  // Add a new portfolio page
  const addPortfolioPage = useMutation({
    mutationFn: async (page: Omit<PortfolioPage, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('User must be logged in');

      const pageData = {
        ...page,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('portfolio_pages')
        .insert([pageData])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      toast({
        title: "Page created",
        description: "Your portfolio page has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create page: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update an existing portfolio page
  const updatePortfolioPage = useMutation({
    mutationFn: async (page: Partial<PortfolioPage> & { id: string }) => {
      const { id, ...updateData } = page;

      const { data, error } = await supabase
        .from('portfolio_pages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', variables.id] });
      toast({
        title: "Page updated",
        description: "Your portfolio page has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update page: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete a portfolio page
  const deletePortfolioPage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase
        .from('portfolio_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw new Error(error.message);
      return pageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-pages'] });
      toast({
        title: "Page deleted",
        description: "Your portfolio page has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete page: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Add project to a portfolio page
  const addProjectToPage = useMutation({
    mutationFn: async ({ pageId, projectId, customDescription = '', displayOrder = 0 }: 
      { pageId: string; projectId: string; customDescription?: string; displayOrder?: number; }) => {
      
      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .insert([{
          portfolio_page_id: pageId,
          project_id: projectId,
          display_order: displayOrder,
          custom_description: customDescription
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', variables.pageId] });
      toast({
        title: "Project added",
        description: "Project has been added to your portfolio page.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add project: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Remove project from a portfolio page
  const removeProjectFromPage = useMutation({
    mutationFn: async ({ pageProjectId, pageId }: { pageProjectId: string, pageId: string }) => {
      const { error } = await supabase
        .from('portfolio_page_projects')
        .delete()
        .eq('id', pageProjectId);

      if (error) throw new Error(error.message);
      return { pageProjectId, pageId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', variables.pageId] });
      toast({
        title: "Project removed",
        description: "Project has been removed from your portfolio page.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove project: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update project order or description
  const updatePortfolioPageProject = useMutation({
    mutationFn: async ({ id, pageId, updates }: 
      { id: string; pageId: string; updates: Partial<PortfolioPageProject> }) => {
      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-page', variables.pageId] });
      toast({
        title: "Project updated",
        description: "Portfolio project has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update project: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Get a public portfolio page by URL slug
  const getPublicPortfolioPage = async (customUrl: string) => {
    const { data, error } = await supabase
      .from('portfolio_pages')
      .select('*')
      .eq('custom_url', customUrl)
      .eq('is_public', true)
      .single();

    if (error) throw new Error(error.message);
    
    // Get all projects for this page
    const { data: projectsData, error: projectsError } = await supabase
      .from('portfolio_page_projects')
      .select(`
        id,
        portfolio_page_id,
        project_id,
        display_order,
        custom_description,
        project:project_id (*)
      `)
      .eq('portfolio_page_id', data.id)
      .order('display_order', { ascending: true });

    if (projectsError) throw new Error(projectsError.message);

    return {
      ...data,
      projects: projectsData
    };
  };

  // Generate shareable link
  const getShareableLink = (customUrl: string) => {
    // This would build a URL to the public portfolio view
    const baseUrl = window.location.origin;
    return `${baseUrl}/portfolio/${customUrl}`;
  };

  // Export portfolio as CSV
  const exportPortfolioAsCSV = async (pageId: string) => {
    try {
      setIsLoading(true);
      
      // Get the page with projects
      const pageData = await fetchPortfolioPageWithProjects(pageId);
      
      if (!pageData || !pageData.projects) {
        throw new Error("No portfolio data found");
      }
      
      // Create CSV content
      let csvContent = "Project Title,Description,Skills,Effort Level,Impact\n";
      
      pageData.projects.forEach(item => {
        const project = item.project;
        if (project) {
          // Use the custom description if available, otherwise use the project description
          const description = item.custom_description || project.description || '';
          const skills = project.required_skills ? project.required_skills.join(', ') : '';
          
          // Escape and format CSV fields correctly
          const escapeCsvField = (field: string) => `"${(field || '').replace(/"/g, '""')}"`;
          
          csvContent += [
            escapeCsvField(project.title),
            escapeCsvField(description),
            escapeCsvField(skills),
            escapeCsvField(project.effort_level || ''),
            escapeCsvField(project.impact || '')
          ].join(',') + '\n';
        }
      });
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `${pageData.title.replace(/\s+/g, '_')}_portfolio.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: "Your portfolio has been exported as CSV.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export portfolio",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    portfolioPages,
    pagesLoading,
    pagesError,
    usePortfolioPageWithProjects,
    addPortfolioPage,
    updatePortfolioPage,
    deletePortfolioPage,
    addProjectToPage,
    removeProjectFromPage,
    updatePortfolioPageProject,
    getPublicPortfolioPage,
    getShareableLink,
    exportPortfolioAsCSV,
    isLoading
  };
}
