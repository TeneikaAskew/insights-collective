
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Interfaces for our data structures
export interface UserProfile {
  interests: string[];
  currentRole: string;
  hobbies: string;
  resumeText?: string;
  actionPlan?: any;
  skills?: string[];
}

export interface TargetRole {
  title: string;
  coreSkills: string[];
  tools: string[];
  deliverables: string[];
  portfolioExamples: {
    title: string;
    type: string;
    description: string;
    link?: string;
  }[];
}

export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  effortLevel: string;
  impact: string;
  roleTitle: string;
}

export interface UserProject {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  effortLevel: string;
  impact: string;
  roadmap?: any;
  status: 'Idea' | 'Planned' | 'In Progress' | 'Completed';
}

export function usePortfolioExplorer() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    interests: [],
    currentRole: '',
    hobbies: '',
  });
  const [targetRoles, setTargetRoles] = useState<TargetRole[]>([]);
  const [projectIdeas, setProjectIdeas] = useState<ProjectIdea[]>([]);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);

  // Fetch user's resume text and action plan on initial load
  useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch resume text
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single();
          
        if (resumeError && resumeError.code !== 'PGRST116') {
          console.error('Error fetching resume:', resumeError);
        }
        
        // Fetch action plan
        const { data: planData, error: planError } = await supabase
          .from('career_pathway_results')
          .select('action_plan')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (planError && planError.code !== 'PGRST116') {
          console.error('Error fetching action plan:', planError);
        }

        // Fetch user's existing projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('portfolio_projects')
          .select(`
            id, 
            title, 
            description, 
            required_skills,
            effort_level,
            impact,
            roadmap,
            project_status (status)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (projectsError) {
          console.error('Error fetching projects:', projectsError);
        } else if (projectsData) {
          // Transform projects data into our format
          const formattedProjects: UserProject[] = projectsData.map((project) => ({
            id: project.id,
            title: project.title,
            description: project.description || '',
            requiredSkills: project.required_skills || [],
            effortLevel: project.effort_level || '',
            impact: project.impact || '',
            roadmap: project.roadmap,
            status: project.project_status?.status as any || 'Idea',
          }));
          
          setUserProjects(formattedProjects);
        }
        
        // Update user profile with fetched data
        if (resumeData || planData) {
          setUserProfile(prev => ({
            ...prev,
            resumeText: resumeData?.text || undefined,
            actionPlan: planData?.action_plan || undefined,
          }));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  // Handler for profile form submission
  const handleProfileSubmit = async (profileData: {
    interests: string[];
    currentRole: string;
    hobbies: string;
  }) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Update user profile
      const updatedProfile: UserProfile = {
        ...userProfile,
        ...profileData,
      };
      setUserProfile(updatedProfile);
      
      // Call together-ai Edge Function for analysis and recommendations
      const togetherResponse = await supabase.functions.invoke('together-ai', {
        body: {
          type: 'portfolio-explorer',
          resumeText: updatedProfile.resumeText,
          actionPlan: updatedProfile.actionPlan,
          questionnaireAnswers: {
            interests: updatedProfile.interests,
            currentRole: updatedProfile.currentRole,
            hobbies: updatedProfile.hobbies,
          },
        },
      });
      
      if (togetherResponse.error) {
        throw new Error(togetherResponse.error.message);
      }
      
      // Parse the response from the AI
      const aiResponse = togetherResponse.data;
      
      if (aiResponse.targetRoles) {
        setTargetRoles(aiResponse.targetRoles);
      }
      
      if (aiResponse.projectIdeas) {
        setProjectIdeas(aiResponse.projectIdeas);
      }
      
      if (aiResponse.userSkills) {
        setUserProfile(prev => ({
          ...prev,
          skills: aiResponse.userSkills,
        }));
      }
      
      toast({
        title: "Profile analysis complete!",
        description: "We've identified target roles and project ideas for your portfolio.",
      });
      
    } catch (error: any) {
      console.error('Error analyzing profile:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "There was an error analyzing your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler to add a new project
  const handleAddProject = async (projectIdea: ProjectIdea) => {
    if (!user) return;
    
    try {
      // Insert the project in the database
      const { data: projectData, error: projectError } = await supabase
        .from('portfolio_projects')
        .insert({
          user_id: user.id,
          title: projectIdea.title,
          description: projectIdea.description,
          required_skills: projectIdea.requiredSkills,
          effort_level: projectIdea.effortLevel,
          impact: projectIdea.impact,
        })
        .select('id')
        .single();
        
      if (projectError) throw projectError;
      
      // Insert the initial project status
      const { error: statusError } = await supabase
        .from('project_status')
        .insert({
          project_id: projectData.id,
          status: 'Idea'
        });
        
      if (statusError) throw statusError;
      
      // Add the project to local state
      const newProject: UserProject = {
        id: projectData.id,
        title: projectIdea.title,
        description: projectIdea.description,
        requiredSkills: projectIdea.requiredSkills,
        effortLevel: projectIdea.effortLevel,
        impact: projectIdea.impact,
        status: 'Idea',
      };
      
      setUserProjects(prev => [newProject, ...prev]);
      
      toast({
        title: "Project added",
        description: `"${projectIdea.title}" has been added to your portfolio.`,
      });
    } catch (error: any) {
      console.error('Error adding project:', error);
      toast({
        title: "Error adding project",
        description: error.message || "There was an error adding the project. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handler to update a project's status
  const handleUpdateProjectStatus = async (projectId: string, newStatus: 'Idea' | 'Planned' | 'In Progress' | 'Completed') => {
    try {
      // Update the project status in the database
      const { error } = await supabase
        .from('project_status')
        .update({ status: newStatus })
        .eq('project_id', projectId);
        
      if (error) throw error;
      
      // Update the project in local state
      setUserProjects(prev => 
        prev.map(project => 
          project.id === projectId 
            ? { ...project, status: newStatus } 
            : project
        )
      );
      
      toast({
        title: "Status updated",
        description: `Project status changed to ${newStatus}.`,
      });
    } catch (error: any) {
      console.error('Error updating project status:', error);
      toast({
        title: "Error updating status",
        description: error.message || "There was an error updating the project status. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    loading,
    userProfile,
    targetRoles,
    projectIdeas,
    userProjects,
    handleProfileSubmit,
    handleAddProject,
    handleUpdateProjectStatus
  };
}
