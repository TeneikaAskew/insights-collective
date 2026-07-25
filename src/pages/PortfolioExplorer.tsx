import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { ProfileForm } from '@/components/portfolio/ProfileForm';
import { ProjectIdeaList } from '@/components/portfolio/ProjectIdeaList';
import { SkillGapChart } from '@/components/portfolio/SkillGapChart';
import { KanbanBoard } from '@/components/portfolio/KanbanBoard';
import { AddProjectDialog } from '@/components/portfolio/AddProjectDialog';
import { PortfolioPagesTab } from '@/components/portfolio/PortfolioPagesTab';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionnaireAnswers, PortfolioInsightData, ProjectIdea, ProjectStatus, PortfolioProject } from '@/types/portfolio';
import { Check, RefreshCw, WandSparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('handleTabChange');

function PortfolioExplorer() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize active tab from URL param if available
    const tabParam = searchParams.get('tab');
    return tabParam === 'discover' || tabParam === 'ideas' || 
           tabParam === 'tracker' || tabParam === 'pages' 
           ? tabParam : 'discover';
  });
  const [portfolioData, setPortfolioData] = useState<PortfolioInsightData | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<QuestionnaireAnswers | null>(null);
  // Add a flag to control tab navigation behavior
  const [forceDiscoverTab, setForceDiscoverTab] = useState(false);
  
  const { toast } = useToast();
  const {
    projects,
    projectsLoading,
    projectsError,
    generatePortfolioIdeas,
    addProject,
    updateProjectStatus,
    updateProject,
    deleteProject,
    isLoading,
    previousRecommendations,
    recommendationsLoading,
    refetchRecommendations
  } = usePortfolio();

  // Handle URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'discover' || tabParam === 'ideas' || 
        tabParam === 'tracker' || tabParam === 'pages') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Set portfolio data from previous recommendations if available
  useEffect(() => {
    if (previousRecommendations && !portfolioData) {
      logger.log('Setting portfolio data from previous recommendations:', previousRecommendations);
      setPortfolioData(previousRecommendations);
      setProfileCompleted(true);
    }
  }, [previousRecommendations, portfolioData]);

  // Update active tab when portfolio data becomes available
  useEffect(() => {
    // Only auto-navigate to ideas tab if we're not forcing the discover tab
    if (portfolioData && activeTab === 'discover' && !forceDiscoverTab) {
      // If data is available and we're on discover tab, move to ideas tab
      setActiveTab('ideas');
    }
  }, [portfolioData, activeTab, forceDiscoverTab]);

  // Add function to fetch existing questionnaire data
  const fetchExistingQuestionnaire = async () => {
    if (!user) return;
    
    try {
      // First try to get from local storage
      const localData = localStorage.getItem(`portfolio_questionnaire_${user.id}`);
      if (localData) {
        const parsedData = JSON.parse(localData);
        setSavedAnswers({
          currentRole: parsedData.current_role,
          interests: parsedData.interests,
          hobbies: parsedData.hobbies
        });
        setProfileCompleted(true);
        return;
      }

      // If not in local storage, fetch from Supabase
      const { data, error } = await supabase
        .from('portfolio')
        .select('current_role, interests, hobbies')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          logger.error("Error fetching questionnaire:", error);
        }
        return;
      }

      if (data) {
        const answers = {
          currentRole: data.current_role,
          interests: data.interests,
          hobbies: data.hobbies
        };
        setSavedAnswers(answers);
        setProfileCompleted(true);
        
        // Save to local storage
        localStorage.setItem(`portfolio_questionnaire_${user.id}`, JSON.stringify({
          current_role: data.current_role,
          interests: data.interests,
          hobbies: data.hobbies
        }));
      }
    } catch (error) {
      logger.error("Error fetching questionnaire:", error);
    }
  };

  // Fetch existing data when component mounts
  useEffect(() => {
    if (user) {
      fetchExistingQuestionnaire();
    }
  }, [user]);

  const handleQuestionnaireSubmit = async (data: QuestionnaireAnswers) => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      
      // Save to local storage first for immediate access
      localStorage.setItem(`portfolio_questionnaire_${user.id}`, JSON.stringify({
        current_role: data.currentRole,
        interests: data.interests,
        hobbies: data.hobbies
      }));
      
      // Check if entry exists
      const { data: existingData, error: fetchError } = await supabase
        .from('portfolio')
        .select('created_at')
        .eq('user_id', user.id)
        .single();

      const payload = {
        user_id: user.id,
        current_role: data.currentRole,
        interests: data.interests,
        hobbies: data.hobbies,
        updated_at: now
      };

      if (!existingData) {
        // If no existing entry, include created_at
        payload['created_at'] = now;
      }

      // Save to Supabase
      const { error: upsertError } = await supabase
        .from('portfolio')
        .upsert(payload);

      if (upsertError) throw upsertError;

      // Generate portfolio ideas
      const result = await generatePortfolioIdeas.mutateAsync(data);
      setPortfolioData(result);
      setProfileCompleted(true);
      setSavedAnswers(data);
      
      // Automatically move to next tab after analysis is complete
      setTimeout(() => {
        setActiveTab('ideas');
      }, 500);
    } catch (error: any) {
      // A failed submit must not end silently — the user clicked a button
      // and nothing would happen otherwise.
      logger.error("Error saving questionnaire data:", error);
      toast({
        title: 'Failed to save your answers',
        description: error?.message || 'Your questionnaire could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAddProject = async (projectIdea: ProjectIdea | any) => {
    if (!user) return;
    
    // Transform the project idea into a portfolio project
    // Ensure title is always defined with a fallback to prevent type errors
    const newProject: Omit<PortfolioProject, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      title: projectIdea.title || 'Untitled Project', // Ensure title is always defined
      description: projectIdea.description || '',
      required_skills: projectIdea.requiredSkills || projectIdea.required_skills || [],
      effort_level: projectIdea.effortLevel || projectIdea.effort_level || 'Medium',
      impact: projectIdea.impact || '',
      roadmap: projectIdea.roadmap ? { milestones: Array.isArray(projectIdea.roadmap) ? projectIdea.roadmap : [] } : undefined,
      status: 'Idea' as ProjectStatus
    };
    
    await addProject.mutateAsync(newProject);
    setActiveTab('tracker');
  };

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    await updateProjectStatus.mutateAsync({ projectId, status: newStatus });
  };

  const handleUpdateProject = async (project: PortfolioProject) => {
    await updateProject.mutateAsync(project);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject.mutateAsync(projectId);
  };

  const handleTabChange = (tab: string) => {
    // Update URL with tab parameter
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tab);
    window.history.replaceState(null, '', `?${newSearchParams.toString()}`);
    
    setActiveTab(tab);
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[70vh]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                Please sign in to access the Portfolio Explorer
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                <a href="/login">Sign In</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4">
        <Card className="mb-6 border-none shadow-none">
          <CardHeader className="px-0">
            <CardTitle className="text-3xl font-bold">Portfolio Explorer</CardTitle>
            <CardDescription>
              Create, plan, and track portfolio projects aligned with your career goals
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 mb-8 w-full max-w-4xl mx-auto h-auto p-2">
              <TabsTrigger value="discover" className="relative flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5">
                <div className={`${profileCompleted ? 'bg-green-500' : 'bg-[#9b87f5]'} rounded-full w-5 h-5 sm:w-6 sm:h-6 text-white flex items-center justify-center text-xs flex-shrink-0`}>
                  {profileCompleted ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : '1'}
                </div>
                <span className="text-xs sm:text-sm">Discover You</span>
              </TabsTrigger>
              <TabsTrigger value="ideas" disabled={!profileCompleted} className="relative flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5">
                <div className="bg-[#9b87f5] rounded-full w-5 h-5 sm:w-6 sm:h-6 text-white flex items-center justify-center text-xs flex-shrink-0">
                  2
                </div>
                <span className="text-xs sm:text-sm">Project Ideas</span>
              </TabsTrigger>
              <TabsTrigger value="tracker" className="relative flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5">
                <div className="bg-[#9b87f5] rounded-full w-5 h-5 sm:w-6 sm:h-6 text-white flex items-center justify-center text-xs flex-shrink-0">
                  3
                </div>
                <span className="text-xs sm:text-sm">Project Tracker</span>
              </TabsTrigger>
              <TabsTrigger value="pages" className="relative flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5">
                <div className="bg-[#9b87f5] rounded-full w-5 h-5 sm:w-6 sm:h-6 text-white flex items-center justify-center text-xs flex-shrink-0">
                  4
                </div>
                <span className="text-xs sm:text-sm">Portfolio Pages</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="discover" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ProfileForm 
                  onSubmit={handleQuestionnaireSubmit}
                  isLoading={isLoading || generatePortfolioIdeas.isPending}
                  initialData={savedAnswers}
                />
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">How It Works</CardTitle>
                    <CardDescription>
                      Your personalized portfolio journey in 4 steps
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="bg-[#9b87f5]/10 text-[#9b87f5] rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Profile Analysis</h3>
                        <p className="text-sm text-gray-500">
                          We analyze your background, resume, and interests to identify optimal career paths.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-[#9b87f5]/10 text-[#9b87f5] rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Project Recommendations</h3>
                        <p className="text-sm text-gray-500">
                          Discover tailored portfolio project ideas aligned with your target roles.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-[#9b87f5]/10 text-[#9b87f5] rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Progress Tracking</h3>
                        <p className="text-sm text-gray-500">
                          Manage your portfolio projects from idea to completion with our visual tracker.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-[#9b87f5]/10 text-[#9b87f5] rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Portfolio Showcase</h3>
                        <p className="text-sm text-gray-500">
                          Create a professional portfolio page to showcase your completed projects.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">What You'll Get</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-[#9b87f5] mt-0.5" />
                      <p className="text-sm">Career-aligned portfolio project ideas</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-[#9b87f5] mt-0.5" />
                      <p className="text-sm">Skill gap analysis with learning resources</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-[#9b87f5] mt-0.5" />
                      <p className="text-sm">Visual project tracker to manage your portfolio</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-[#9b87f5] mt-0.5" />
                      <p className="text-sm">Shareable portfolio pages to showcase your work</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ideas">
            {generatePortfolioIdeas.isPending ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9b87f5]"></div>
                <p className="mt-4 text-gray-500">Analyzing your profile and generating project ideas...</p>
              </div>
            ) : portfolioData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Project Ideas</h2>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPortfolioData(null);
                        // Set the force discover tab flag to true to prevent auto-navigation
                        setForceDiscoverTab(true);
                        setActiveTab('discover');
                      }}
                    >
                      Update Profile
                    </Button>
                  </div>
                  <ProjectIdeaList 
                    targetRoles={portfolioData.targetRoles} 
                    onAddProject={handleAddProject}
                  />
                </div>
                <div>
                  <SkillGapChart 
                    userSkills={portfolioData.skills}
                    missingSkills={portfolioData.skillGaps.missingSkills}
                    learningResources={portfolioData.skillGaps.learningResources}
                  />
                </div>
              </div>
            ) : recommendationsLoading ? (
              // Show loading indicator while fetching previous recommendations
              <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9b87f5]"></div>
                <p className="mt-4 text-gray-500">Loading your previous portfolio recommendations...</p>
              </div>
            ) : previousRecommendations ? (
              // This should handle the case when previousRecommendations exists but hasn't been set to portfolioData yet
              <div className="flex flex-col items-center justify-center h-64">
                <Button 
                  onClick={() => {
                    if (previousRecommendations) {
                      logger.log("Loading previous recommendations:", previousRecommendations);
                      setPortfolioData(previousRecommendations);
                    }
                  }}
                  className="bg-[#9b87f5] hover:bg-[#8B5CF6] mb-4"
                >
                  Load Your Previous Recommendations
                </Button>
              </div>
            ) : savedAnswers ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Project Ideas</CardTitle>
                    <CardDescription>
                      Your profile is complete. Click below to generate personalized project ideas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    <Button 
                      onClick={() => handleQuestionnaireSubmit(savedAnswers)}
                      disabled={generatePortfolioIdeas.isPending}
                      className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                    >
                      {generatePortfolioIdeas.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating Ideas...
                        </>
                      ) : (
                        'Generate Project Ideas'
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSavedAnswers(null);
                        setActiveTab('discover');
                      }}
                    >
                      Update Profile First
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Complete Your Profile</CardTitle>
                  <CardDescription>
                    Please fill out the questionnaire in the "Discover You" tab first.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setActiveTab('discover')}>
                    Go to Profile Questionnaire
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {portfolioData && (
              <div className="mt-8 flex justify-center">
                <Button 
                  className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                  onClick={() => {
                    setForceDiscoverTab(false); // Reset the force flag when navigating away
                    setActiveTab('tracker');
                  }}
                >
                  Go to Project Tracker
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tracker">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">My Portfolio Projects</h2>
              <AddProjectDialog onAddProject={handleAddProject} />
            </div>

            {projectsLoading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9b87f5]"></div>
                <p className="mt-4 text-gray-500">Loading your projects...</p>
              </div>
            ) : projectsError ? (
              <Card>
                <CardHeader>
                  <CardTitle>Failed to load your projects</CardTitle>
                  <CardDescription role="alert">
                    {projectsError instanceof Error ? projectsError.message : 'Please try again.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : projects && projects.length > 0 ? (
              <KanbanBoard 
                projects={projects}
                onStatusChange={handleStatusChange}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Projects Yet</CardTitle>
                  <CardDescription>
                    You haven't added any portfolio projects yet. Get started by adding a custom project or explore our recommendations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={() => setActiveTab('ideas')}>
                    Explore Recommended Projects
                  </Button>
                  <AddProjectDialog onAddProject={handleAddProject} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="pages">
            <PortfolioPagesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default PortfolioExplorer;
