import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { ProfileForm } from '@/components/portfolio/ProfileForm';
import { ProjectIdeaList } from '@/components/portfolio/ProjectIdeaList';
import { SkillGapChart } from '@/components/portfolio/SkillGapChart';
import { KanbanBoard } from '@/components/portfolio/KanbanBoard';
import { AddProjectDialog } from '@/components/portfolio/AddProjectDialog';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { QuestionnaireAnswers, PortfolioInsightData, ProjectIdea, ProjectStatus, PortfolioProject } from '@/types/portfolio';
import { Check, WandSparkles } from 'lucide-react';

function PortfolioExplorer() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('discover');
  const [portfolioData, setPortfolioData] = useState<PortfolioInsightData | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  
  const {
    projects,
    projectsLoading,
    generatePortfolioIdeas,
    addProject,
    updateProjectStatus,
    updateProject,
    deleteProject,
    isLoading,
  } = usePortfolio();

  const handleQuestionnaireSubmit = async (data: QuestionnaireAnswers) => {
    try {
      const result = await generatePortfolioIdeas.mutateAsync(data);
      setPortfolioData(result);
      setProfileCompleted(true);
      
      // Automatically move to next tab after analysis is complete
      setTimeout(() => {
        setActiveTab('ideas');
      }, 500);
    } catch (error) {
      console.error("Error generating portfolio ideas:", error);
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 gap-4 mb-8 w-full max-w-2xl mx-auto">
            <TabsTrigger value="discover" className="relative">
              <div className="flex items-center gap-2">
                <div className={`${profileCompleted ? 'bg-green-500' : 'bg-[#9b87f5]'} rounded-full w-6 h-6 text-white flex items-center justify-center text-xs`}>
                  {profileCompleted ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <span>Discover You</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="ideas" disabled={!profileCompleted}>
              <div className="flex items-center gap-2">
                <div className="bg-[#9b87f5] rounded-full w-6 h-6 text-white flex items-center justify-center text-xs">
                  2
                </div>
                <span>Project Ideas</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="tracker">
              <div className="flex items-center gap-2">
                <div className="bg-[#9b87f5] rounded-full w-6 h-6 text-white flex items-center justify-center text-xs">
                  3
                </div>
                <span>Project Tracker</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ProfileForm 
                  onSubmit={handleQuestionnaireSubmit}
                  isLoading={isLoading || generatePortfolioIdeas.isPending}
                />
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">How It Works</CardTitle>
                    <CardDescription>
                      Your personalized portfolio journey in 3 steps
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
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ideas">
            {generatePortfolioIdeas.isPending ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-500">Analyzing your profile and generating project ideas...</p>
              </div>
            ) : portfolioData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
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
                  onClick={() => setActiveTab('tracker')}
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
                <Spinner size="lg" />
                <p className="mt-4 text-gray-500">Loading your projects...</p>
              </div>
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
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default PortfolioExplorer;
