import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioPage, PortfolioPageProject, PortfolioTheme, ProfileData } from '@/types/portfolio';
import { useAuth } from '@/contexts/AuthContext';

export function usePortfolioPages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get all portfolio pages for the current user
  const {
    data: portfolioPages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useQuery({
    queryKey: ['portfolioPages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('portfolio_pages')
        .select('*, projects:portfolio_page_projects(*)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      return data as PortfolioPage[];
    },
    enabled: !!user?.id,
  });
  
  // Get a single portfolio page with its projects
  const usePortfolioPageWithProjects = (pageId?: string) => {
    return useQuery({
      queryKey: ['portfolioPage', pageId],
      queryFn: async () => {
        if (!pageId) return null;
        
        const { data: page, error: pageError } = await supabase
          .from('portfolio_pages')
          .select('*')
          .eq('id', pageId)
          .single();
          
        if (pageError) throw pageError;
        
        const { data: projects, error: projectsError } = await supabase
          .from('portfolio_page_projects')
          .select(`
            *,
            project:portfolio_projects(*)
          `)
          .eq('portfolio_page_id', pageId)
          .order('display_order');
          
        if (projectsError) throw projectsError;
        
        return {
          ...page,
          projects: projects as PortfolioPageProject[]
        } as PortfolioPage;
      },
      enabled: !!pageId
    });
  };
  
  // Add a new portfolio page
  const addPortfolioPage = useMutation({
    mutationFn: async (pageData: {
      title: string;
      description: string;
      theme: PortfolioTheme;
      is_public: boolean;
      custom_url: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('portfolio_pages')
        .insert({
          user_id: user.id,
          title: pageData.title,
          description: pageData.description,
          theme: pageData.theme,
          is_public: pageData.is_public,
          custom_url: pageData.custom_url,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });
  
  // Update an existing portfolio page
  const updatePortfolioPage = useMutation({
    mutationFn: async (pageData: {
      id: string;
      title?: string;
      description?: string;
      theme?: PortfolioTheme;
      is_public?: boolean;
      custom_url?: string;
      profile_data?: ProfileData;
    }) => {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .update({
          title: pageData.title,
          description: pageData.description,
          theme: pageData.theme,
          is_public: pageData.is_public,
          custom_url: pageData.custom_url,
          profile_data: pageData.profile_data,
        })
        .eq('id', pageData.id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });
  
  // Get projects for a specific portfolio page
  const getPortfolioPageProjects = async (pageId: string) => {
    const { data, error } = await supabase
      .from('portfolio_page_projects')
      .select(`
        *,
        project:portfolio_projects(*)
      `)
      .eq('portfolio_page_id', pageId)
      .order('display_order');
      
    if (error) throw error;
    
    // Transform the data to match the expected type
    const transformedData: PortfolioPageProject[] = data.map((item: any) => ({
      id: item.id,
      portfolio_page_id: item.portfolio_page_id,
      project_id: item.project_id,
      display_order: item.display_order,
      custom_description: item.custom_description,
      project: item.project,
    }));
    
    return transformedData;
  };
  
  // Delete a portfolio page
  const deletePortfolioPage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase
        .from('portfolio_pages')
        .delete()
        .eq('id', pageId);
        
      if (error) throw error;
      return pageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });

  // Add a project to a portfolio page
  const addProjectToPage = useMutation({
    mutationFn: async ({ pageId, projectId, displayOrder = 0 }: { pageId: string; projectId: string; displayOrder?: number }) => {
      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .insert({
          portfolio_page_id: pageId,
          project_id: projectId,
          display_order: displayOrder,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPage', data.portfolio_page_id] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });
  
  // Remove a project from a portfolio page
  const removeProjectFromPage = useMutation({
    mutationFn: async ({ pageProjectId, pageId }: { pageProjectId: string; pageId: string }) => {
      const { error } = await supabase
        .from('portfolio_page_projects')
        .delete()
        .eq('id', pageProjectId);
      
      if (error) throw error;
      return { pageProjectId, pageId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPage', data.pageId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });
  
  // Update a portfolio page project (for custom descriptions or reordering)
  const updatePortfolioPageProject = useMutation({
    mutationFn: async ({ id, pageId, updates }: { id: string; pageId: string; updates: any }) => {
      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolioPage', data.portfolio_page_id] });
      queryClient.invalidateQueries({ queryKey: ['portfolioPages', user?.id] });
    },
  });
  
  // Get public portfolio page by custom URL
  const getPublicPortfolioPage = async (customUrl: string) => {
    // First get the portfolio page data
    const { data: page, error: pageError } = await supabase
      .from('portfolio_pages')
      .select('*')
      .eq('custom_url', customUrl)
      .eq('is_public', true)
      .single();
      
    if (pageError) throw pageError;
    
    // Then get the projects for this page
    const { data: projects, error: projectsError } = await supabase
      .from('portfolio_page_projects')
      .select(`
        *,
        project:portfolio_projects(*)
      `)
      .eq('portfolio_page_id', page.id)
      .order('display_order');
      
    if (projectsError) throw projectsError;
    
    return {
      ...page,
      projects: projects as PortfolioPageProject[]
    };
  };
  
  // Get a shareable link for a portfolio page
  const getShareableLink = (customUrl: string) => {
    return `${window.location.origin}/portfolio/${customUrl}`;
  };
  
  // Export portfolio as CSV
  const exportPortfolioAsCSV = async (pageId: string) => {
    try {
      // First get the portfolio page data
      const portfolioPage = await queryClient.fetchQuery({
        queryKey: ['portfolioPage', pageId],
        queryFn: async () => {
          const { data: page, error: pageError } = await supabase
            .from('portfolio_pages')
            .select('*')
            .eq('id', pageId)
            .single();
            
          if (pageError) throw pageError;
          
          const { data: projects, error: projectsError } = await supabase
            .from('portfolio_page_projects')
            .select(`
              *,
              project:portfolio_projects(*)
            `)
            .eq('portfolio_page_id', pageId)
            .order('display_order');
            
          if (projectsError) throw projectsError;
          
          return {
            ...page,
            projects: projects as PortfolioPageProject[]
          };
        }
      });
      
      if (!portfolioPage || !portfolioPage.projects) {
        throw new Error('Portfolio not found');
      }
      
      // Create CSV content
      let csvContent = 'Title,Description,Skills,Impact,Effort Level\n';
      
      portfolioPage.projects.forEach(projectItem => {
        const project = projectItem.project;
        if (!project) return;
        
        const title = `"${project.title.replace(/"/g, '""')}"`;
        const description = `"${(projectItem.custom_description || project.description || '').replace(/"/g, '""')}"`;
        const skills = `"${project.required_skills ? project.required_skills.join(', ').replace(/"/g, '""') : ''}"`;
        const impact = `"${(project.impact || '').replace(/"/g, '""')}"`;
        const effortLevel = `"${(project.effort_level || '').replace(/"/g, '""')}"`;
        
        csvContent += `${title},${description},${skills},${impact},${effortLevel}\n`;
      });
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `portfolio-${portfolioPage.title.replace(/\s+/g, '-')}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting portfolio:', error);
      throw error;
    }
  };

  return {
    portfolioPages,
    pagesLoading,
    pagesError,
    addPortfolioPage,
    updatePortfolioPage,
    getPortfolioPageProjects,
    deletePortfolioPage,
    usePortfolioPageWithProjects,
    addProjectToPage,
    removeProjectFromPage,
    updatePortfolioPageProject,
    getPublicPortfolioPage,
    exportPortfolioAsCSV,
    getShareableLink,
  };
}
