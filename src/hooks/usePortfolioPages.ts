
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioPage, PortfolioPageProject, PortfolioTheme } from '@/types/portfolio';
import { useAuth } from '@/contexts/AuthContext';

export function usePortfolioPages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  
  const updatePortfolioPage = useMutation({
    mutationFn: async (pageData: {
      id: string;
      title?: string;
      description?: string;
      theme?: PortfolioTheme;
      is_public?: boolean;
      custom_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('portfolio_pages')
        .update({
          title: pageData.title,
          description: pageData.description,
          theme: pageData.theme,
          is_public: pageData.is_public,
          custom_url: pageData.custom_url,
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

  return {
    portfolioPages,
    pagesLoading,
    pagesError,
    addPortfolioPage,
    updatePortfolioPage,
    getPortfolioPageProjects,
    deletePortfolioPage,
  };
}
