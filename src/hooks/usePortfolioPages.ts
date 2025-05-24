
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PortfolioPage, PortfolioPageProject } from '@/types/portfolio';

export function usePortfolioPages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch portfolio pages
  const { data: portfolioPages, isLoading: pagesLoading } = useQuery({
    queryKey: ['portfolio-pages', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

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

      if (error) throw error;
      return data as PortfolioPage[];
    },
    enabled: !!user,
  });

  // Add project to portfolio page
  const addProjectToPage = useMutation({
    mutationFn: async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if project is already in this portfolio
      const { data: existingProject } = await supabase
        .from('portfolio_page_projects')
        .select('id')
        .eq('portfolio_page_id', pageId)
        .eq('project_id', projectId)
        .single();

      if (existingProject) {
        throw new Error('Project is already in this portfolio');
      }

      // Get the highest display order for this portfolio
      const { data: maxOrderData } = await supabase
        .from('portfolio_page_projects')
        .select('display_order')
        .eq('portfolio_page_id', pageId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrderData?.display_order || 0) + 1;

      const { data, error } = await supabase
        .from('portfolio_page_projects')
        .insert({
          portfolio_page_id: pageId,
          project_id: projectId,
          display_order: nextOrder,
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
        description: "Project added to portfolio successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add project to portfolio.",
        variant: "destructive",
      });
    },
  });

  return {
    portfolioPages,
    pagesLoading,
    addProjectToPage,
  };
}
