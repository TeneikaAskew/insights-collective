import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PortfolioProject, ProjectStatus, QuestionnaireAnswers, PortfolioInsightData } from '@/types/portfolio';

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<any | null>(null);

  // Fetch user's portfolio projects
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['portfolio-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: projectsData, error: projectsError } = await supabase
        .from('portfolio_projects')
        .select('*')
        .eq('user_id', user.id);

      if (projectsError) throw new Error(projectsError.message);

      // Fetch status for each project if needed, but since status is now part of portfolio_projects table
      // this separate fetch is no longer necessary, but we'll leave the code here for backward compatibility
      try {
        const projectIds = projectsData.map(p => p.id);
        if (projectIds.length > 0) {
          const { data: statusData, error: statusError } = await supabase
            .from('project_status')
            .select('*')
            .in('project_id', projectIds);

          if (statusError) console.error("Error fetching status data:", statusError);

          // Merge projects with their status if status is not already in the project
          return projectsData.map(project => {
            if (project.status) {
              return project; // Status column already exists in the project
            } else {
              // Fallback to the separate status table
              const status = statusData?.find(s => s.project_id === project.id);
              return {
                ...project,
                status: status?.status || 'Idea'
              };
            }
          });
        }
      } catch (err) {
        console.error("Error processing project status:", err);
      }

      // If no separate status data or if there was an error, just return projects with default status
      return projectsData.map(project => ({
        ...project,
        status: project.status || 'Idea'
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch previously generated portfolio recommendations
  const { data: previousRecommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['portfolio-recommendations', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      try {
        const { data, error } = await supabase
          .from('resumes')
          .select('recommendation, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching portfolio recommendations:', error);
          return null;
        }

        if (data && data.length > 0 && data[0].recommendation) {
          console.info('Found previous portfolio recommendations');
          return data[0].recommendation as PortfolioInsightData;
        }

        return null;
      } catch (err) {
        console.error('Error in fetchPreviousRecommendations:', err);
        return null;
      }
    },
    enabled: !!user?.id
  });

  // Fetch the user's resume text
  const { data: resume } = useQuery({
    queryKey: ['resume', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('resumes')
        .select('text')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.text) setResumeText(data.text);
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch the user's career action plan
  const { data: plan } = useQuery({
    queryKey: ['career-pathway-results', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('action_plan')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data?.action_plan) setActionPlan(data.action_plan);
      return data;
    },
    enabled: !!user?.id,
  });

  // Generate portfolio ideas using the edge function
  const generatePortfolioIdeas = useMutation({
    mutationFn: async (questionnaireAnswers: QuestionnaireAnswers): Promise<PortfolioInsightData> => {
      if (!user?.id) {
        throw new Error('User must be logged in to generate portfolio ideas');
      }

      setIsLoading(true);

      try {
        console.log('Calling portfolio-ideas function with:', {
          resumeText,
          actionPlan,
          questionnaireAnswers,
          userId: user.id
        });
        
        // Call the portfolio-ideas edge function
        const { data, error } = await supabase.functions.invoke<{ success: boolean, data: PortfolioInsightData }>('portfolio-ideas', {
          body: {
            resumeText,
            actionPlan,
            questionnaireAnswers,
            userId: user.id
          }
        });

        if (error) {
          console.error('Edge function error:', error);
          throw new Error(error.message);
        }
        
        console.log('Response from portfolio-ideas function:', data);

        if (!data?.success || !data?.data) {
          throw new Error('Failed to generate portfolio ideas');
        }

        // Invalidate recommendations cache to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['portfolio-recommendations', user.id] });

        return data.data;
      } catch (err) {
        console.error('Error in generatePortfolioIdeas:', err);
        toast({
          title: "Error",
          description: "Failed to generate portfolio ideas. Please try again.",
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Portfolio ideas generated successfully",
      });
    }
  });

  // Add a new project
  const addProject = useMutation({
    mutationFn: async (project: Omit<PortfolioProject, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('User must be logged in');

      const projectData = {
        ...project,
        user_id: user.id,
        // Ensure status is included in the insert
        status: project.status || 'Idea'
      };

      // Insert the project with status included
      const { data: newProject, error: projectError } = await supabase
        .from('portfolio_projects')
        .insert([projectData])
        .select('*')
        .single();

      if (projectError) throw new Error(projectError.message);

      return newProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
      toast({
        title: "Project added",
        description: "Your project has been added to your portfolio.",
      });
    },
    onError: (error) => {
      console.error('Error adding project:', error);
      toast({
        title: "Error",
        description: "Failed to add project. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update project status
  const updateProjectStatus = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string, status: ProjectStatus }) => {
      // Now update status directly in the portfolio_projects table
      const { error } = await supabase
        .from('portfolio_projects')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (error) throw new Error(error.message);

      return { projectId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
      toast({
        title: "Status updated",
        description: "Project status has been updated.",
      });
    },
    onError: (error) => {
      console.error('Error updating project status:', error);
      toast({
        title: "Error",
        description: "Failed to update project status. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update project details
  const updateProject = useMutation({
    mutationFn: async (project: Partial<PortfolioProject> & { id: string }) => {
      const { id, ...updateData } = project;

      // Update project details including status if provided
      const { error: projectError } = await supabase
        .from('portfolio_projects')
        .update(updateData)
        .eq('id', id);

      if (projectError) throw new Error(projectError.message);

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
      toast({
        title: "Project updated",
        description: "Your project has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete a project
  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      // The status will be automatically deleted when the project is deleted
      const { error } = await supabase
        .from('portfolio_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw new Error(error.message);

      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
      toast({
        title: "Project deleted",
        description: "Your project has been removed from your portfolio.",
      });
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  });

  return {
    projects,
    projectsLoading,
    projectsError,
    resume,
    plan,
    generatePortfolioIdeas,
    addProject,
    updateProjectStatus,
    updateProject,
    deleteProject,
    isLoading,
    previousRecommendations,
    recommendationsLoading
  };
}
