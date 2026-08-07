import React, { useState, useEffect, useRef } from 'react';
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

/**
 * One step in the tab strip.
 *
 * `rounded-full` overrides TabsTrigger's `rounded-sm`; it comes after in the
 * class list, which is what cn() relies on to resolve the conflict. The active
 * state (`bg-background`, shadow) is inherited from the base rather than
 * restated here, so a change to the design system reaches this too.
 */
const stepClass =
  'flex-1 min-w-max gap-2 rounded-full px-4 py-2 text-muted-foreground ' +
  'data-[state=active]:text-foreground';

const TABS = ['discover', 'ideas', 'tracker', 'pages'] as const;

/**
 * One place that decides whether a ?tab= value is real.
 *
 * This test was written out twice — once to pick the initial tab, once to
 * decide whether the landing choice had already been made — and the second
 * copy accepted any non-empty string. So `?tab=projects` (a plausible guess,
 * since the tab is labelled "Your projects") fell back to `discover` for
 * rendering while counting as a deliberate choice, permanently suppressing
 * the landing effect and stranding an answered reader on a questionnaire
 * they had already filled in.
 */
const isValidTab = (value: string | null): value is (typeof TABS)[number] =>
  !!value && (TABS as readonly string[]).includes(value);

function PortfolioExplorer() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Initialize active tab from URL param if available
    const tabParam = searchParams.get('tab');
    return isValidTab(tabParam) ? tabParam : 'discover';
  });
  const [portfolioData, setPortfolioData] = useState<PortfolioInsightData | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<QuestionnaireAnswers | null>(null);
  /**
   * True once the landing tab has been settled, either by us or by the reader.
   *
   * The profile resolves asynchronously — localStorage first, then the
   * `portfolio` row — so the tab cannot be chosen at mount. This ref lets the
   * choice happen exactly once, when the answer arrives, without yanking
   * someone off a tab they have already clicked.
   */
  const tabSettled = useRef(isValidTab(searchParams.get('tab')));

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
    if (isValidTab(tabParam)) {
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

  /**
   * Land people on their work.
   *
   * This used to bounce anyone with saved recommendations from `discover` to
   * `ideas`, which meant nobody ever arrived at their projects — `tracker` was
   * reachable the whole time, and nothing ever took you there. You either saw
   * a questionnaire you had already answered, or a list of ideas you had
   * already read.
   *
   * Now: answered once, you land on your projects. Not answered, you land on
   * the questionnaire, which is the only thing you can usefully do.
   *
   * Runs once. An explicit ?tab= wins, and so does any tab the reader clicks
   * before the profile resolves.
   */
  useEffect(() => {
    if (tabSettled.current) return;
    if (!profileCompleted) return;
    tabSettled.current = true;
    setActiveTab('tracker');
  }, [profileCompleted]);

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

      // If not in local storage, fetch from Supabase.
      //
      // maybeSingle, not single. A user who has not filled the questionnaire in
      // has no `portfolio` row, and single() turns that ordinary state into an
      // HTTP 406 with PGRST116. The code below already treated PGRST116 as
      // "not found", but the request had failed by then — every visit logged
      // four Supabase errors and the failed-query badge counted them.
      const { data, error } = await supabase
        .from('portfolio')
        .select('current_role, interests, hobbies')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching questionnaire:", error);
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

  // Fetch existing data when component mounts.
  //
  // Keyed on user.id, not the user object. AuthContext hands back a new object
  // as the session settles, so a dependency on `user` re-ran this four times on
  // a single page load — four identical round trips for one answer.
  useEffect(() => {
    if (user) {
      fetchExistingQuestionnaire();
    }
  }, [user?.id]);

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
      
      // Check if entry exists. maybeSingle for the same reason as above — the
      // first submission is exactly the case with no row, so single() made the
      // common path an error. fetchError is now a real failure, not "no row".
      const { data: existingData, error: fetchError } = await supabase
        .from('portfolio')
        .select('created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

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

      // Settle the tab BEFORE profileCompleted flips.
      //
      // Order matters and I had it backwards. setProfileCompleted(true) arms
      // the landing effect, which sends a first-time submitter to `tracker`
      // immediately — and the navigation below only lands 500ms later. So the
      // tracker was shown for half a second on the way to the ideas that had
      // just been generated, which is the flash a comment here used to claim
      // was prevented. Settling first makes the effect a no-op, and also stops
      // it overwriting a tab the reader picks during that window.
      tabSettled.current = true;

      setPortfolioData(result);
      setProfileCompleted(true);
      setSavedAnswers(data);

      // Straight to the ideas that were just generated.
      setTimeout(() => {
        handleTabChange('ideas');
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
    handleTabChange('tracker');
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
    // Whatever the reader picks wins, including over the landing choice that
    // has not been made yet — the profile may still be in flight.
    tabSettled.current = true;

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
              <Button asChild>
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
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Build projects that prove you can do the job —{' '}
            <span className="ss-serif">then put them somewhere people can see.</span>
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          {/* One rounded track, scrolling on a phone rather than wrapping to a
              2x2 block. `step` keeps the numbered circles — they encode a real
              sequence — and the active step is the one that lifts.
              The `after:` fade is the scroll affordance: four steps do not fit
              at 390px, and a row that scrolls with nothing to say so is a dead
              end. Tied to the `sm` breakpoint rather than measured — above it
              the strip fits inside max-w-4xl and the fade is hidden. */}
          {/* mb-8 sits on the wrapper, not the list: the fade is `inset-y-0`
              against this box, and a bottom margin inside it would stretch the
              gradient into the gap below the strip. */}
          <div className="relative w-full max-w-4xl mx-auto mb-8
                          after:pointer-events-none after:absolute after:inset-y-0 after:right-0
                          after:w-10 after:rounded-r-full after:bg-gradient-to-r
                          after:from-transparent after:to-muted sm:after:hidden">
            <TabsList className="flex w-full h-auto gap-1 rounded-full p-1.5 overflow-x-auto">
              <TabsTrigger value="discover" className={stepClass}>
                <span className={`${profileCompleted ? 'bg-ss-good' : 'bg-ss-lav-chip text-ss-lav-deep'} rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold flex-shrink-0`}>
                  {profileCompleted ? <Check className="h-3 w-3 text-primary-foreground" /> : '1'}
                </span>
                Discover you
              </TabsTrigger>
              <TabsTrigger value="ideas" disabled={!profileCompleted} className={stepClass}>
                <span className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  2
                </span>
                Project ideas
              </TabsTrigger>
              <TabsTrigger value="tracker" className={stepClass}>
                <span className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  3
                </span>
                Your projects
              </TabsTrigger>
              <TabsTrigger value="pages" className={stepClass}>
                <span className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  4
                </span>
                Your portfolio page
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
                      <div className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Profile Analysis</h3>
                        <p className="text-sm text-muted-foreground">
                          We analyze your background, resume, and interests to identify optimal career paths.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Project Recommendations</h3>
                        <p className="text-sm text-muted-foreground">
                          Discover tailored portfolio project ideas aligned with your target roles.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Progress Tracking</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage your portfolio projects from idea to completion with our visual tracker.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="bg-ss-lav-chip text-ss-lav-deep rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Portfolio Showcase</h3>
                        <p className="text-sm text-muted-foreground">
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
                      <WandSparkles className="h-4 w-4 text-ss-lav-deep mt-0.5" />
                      <p className="text-sm">Career-aligned portfolio project ideas</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-ss-lav-deep mt-0.5" />
                      <p className="text-sm">Skill gap analysis with learning resources</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-ss-lav-deep mt-0.5" />
                      <p className="text-sm">Visual project tracker to manage your portfolio</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <WandSparkles className="h-4 w-4 text-ss-lav-deep mt-0.5" />
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Analyzing your profile and generating project ideas...</p>
              </div>
            ) : portfolioData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Project Ideas</h2>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        // Back to the questionnaire, pre-filled: `savedAnswers`
                        // is left alone and feeds ProfileForm's initialData, so
                        // this is an edit rather than a blank restart.
                        setPortfolioData(null);
                        handleTabChange('discover');
                      }}
                    >
                      Regenerate ideas
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading your previous portfolio recommendations...</p>
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
                  className="mb-4"
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
                      className="rounded-full"
                      onClick={() => {
                        // `setSavedAnswers(null)` used to run here, which threw
                        // away the answers on the way to the form that displays
                        // them — so "update" meant retyping all three from
                        // scratch. Navigating is the whole job.
                        handleTabChange('discover');
                      }}
                    >
                      Edit your answers
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
                  <Button className="rounded-full" onClick={() => handleTabChange('discover')}>
                    Answer the questionnaire
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {portfolioData && (
              <div className="mt-8 flex justify-center">
                <Button className="rounded-full" onClick={() => handleTabChange('tracker')}>
                  Go to your projects
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tracker">
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Your projects</h2>
                <p className="text-sm text-muted-foreground">Everything you are building, and how far along it is.</p>
              </div>
              {/* Only when there is a list to add to. With none, the empty state
                  below already offers this and the two buttons were the same
                  action twice, side by side, at the same emphasis. */}
              {projects && projects.length > 0 && (
                <AddProjectDialog onAddProject={handleAddProject} />
              )}
            </div>

            {projectsLoading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading your projects...</p>
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
                projects={projects as unknown as PortfolioProject[]}
                onStatusChange={handleStatusChange}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
              />
            ) : (
              <Card className="ss-card bg-card">
                <CardHeader>
                  <CardTitle>Nothing here yet</CardTitle>
                  <CardDescription>
                    Add a project you are already working on, or start from the ideas built for your answers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-3">
                  <Button className="rounded-full" onClick={() => handleTabChange('ideas')}>
                    Explore recommended projects
                  </Button>
                  {/* Secondary: two filled buttons of equal weight made the
                      reader choose between them rather than showing a path. */}
                  <AddProjectDialog onAddProject={handleAddProject} variant="outline" />
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
