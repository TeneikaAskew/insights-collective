import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PortfolioProject, ProjectStatus, QuestionnaireAnswers, PortfolioInsightData } from '@/types/portfolio';

import { createLogger } from '@/utils/logger';

const logger = createLogger('usePortfolio');

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<any | null>(null);
  
  // Key for local storage
  const getLocalStorageKey = () => `portfolio_recommendations_${user?.id}`;

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

          if (statusError) logger.error("Error fetching status data:", statusError);

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
        logger.error("Error processing project status:", err);
      }

      // If no separate status data or if there was an error, just return projects with default status
      return projectsData.map(project => ({
        ...project,
        status: project.status || 'Idea'
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch previously generated portfolio recommendations - improved reliability
  const { data: previousRecommendations, isLoading: recommendationsLoading, error: recommendationsError, refetch: refetchRecommendations } = useQuery({
    queryKey: ['portfolio-recommendations', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // First check local storage for most recent recommendations
      try {
        const localData = localStorage.getItem(getLocalStorageKey());
        if (localData) {
          logger.info('Found portfolio recommendations in local storage');
          return JSON.parse(localData) as PortfolioInsightData;
        }
      } catch (err) {
        logger.error('Error retrieving from local storage:', err);
      }

      // Check the portfolio table which is the primary source. A query
      // failure must surface via the query error state instead of being
      // silently converted into "no recommendations".
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio')
        .select('recommendations')
        .eq('user_id', user.id)
        .maybeSingle();

      if (portfolioError) {
        logger.error('Error fetching portfolio recommendations from portfolio table:', portfolioError);
        throw portfolioError;
      }

      if (portfolioData?.recommendations) {
        logger.info('Found portfolio recommendations in portfolio table');

        // Store in local storage for faster retrieval next time
        try {
          localStorage.setItem(getLocalStorageKey(), JSON.stringify(portfolioData.recommendations));
        } catch (storageErr) {
          logger.error('Error storing recommendations in local storage:', storageErr);
        }

        return portfolioData.recommendations as unknown as PortfolioInsightData;
      }

      logger.info('No portfolio recommendations found');
      return null;
    },
    enabled: !!user?.id,
    staleTime: 300000, // Keep fresh for 5 minutes
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
        logger.log('Calling portfolio-ideas function with:', {
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
          logger.error('Edge function error:', error);
          throw new Error(error.message);
        }
        
        logger.log('Response from portfolio-ideas function:', data);

        if (!data?.success || !data?.data) {
          throw new Error('Failed to generate portfolio ideas');
        }

        // Store in local storage
        try {
          localStorage.setItem(getLocalStorageKey(), JSON.stringify(data.data));
        } catch (storageErr) {
          logger.error('Error storing recommendations in local storage:', storageErr);
        }

        // Invalidate recommendations cache to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['portfolio-recommendations', user.id] });

        return data.data;
      } catch (err) {
        logger.error('Error in generatePortfolioIdeas:', err);
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
      // Force a refetch of recommendations after generation
      refetchRecommendations();
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
      logger.error('Error adding project:', error);
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
      logger.error('Error updating project status:', error);
      toast({
        title: "Error",
        description: "Failed to update project status. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update project details - Fixed to properly handle all fields including URLs
  const updateProject = useMutation({
    mutationFn: async (project: Partial<PortfolioProject> & { id: string }) => {
      if (!user?.id) throw new Error('User must be logged in');
      
      const { id, ...updateData } = project;

      // Ensure updated_at is set
      const dataToUpdate = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      logger.log('Updating project with data:', dataToUpdate);

      // Update project details including status if provided
      const { data, error: projectError } = await supabase
        .from('portfolio_projects')
        .update(dataToUpdate)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user can only update their own projects
        .select('*')
        .single();

      if (projectError) {
        logger.error('Database update error:', projectError);
        throw new Error(projectError.message);
      }

      logger.log('Project updated successfully:', data);
      return data;
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
      toast({
        title: "Project updated",
        description: "Your project has been updated successfully.",
      });
    },
    onError: (error) => {
      logger.error('Error updating project:', error);
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
      logger.error('Error deleting project:', error);
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
    recommendationsLoading,
    recommendationsError,
    refetchRecommendations
  };
}
