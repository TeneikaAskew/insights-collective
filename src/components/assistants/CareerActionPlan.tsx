
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Briefcase,
  GraduationCap,
  MessageSquare,
  Target,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ActionPlanTimeframe {
  skills: Array<{
    name: string;
    courses: Array<{
      title: string;
      provider: string;
      url?: string;
    }>;
  }>;
  projects: Array<{
    title: string;
    description: string;
  }>;
  content: Array<{
    platform: string;
    topics: string[];
  }>;
  milestones: string[];
  narrative: string;
}

interface ActionPlan {
  "6_weeks": ActionPlanTimeframe;
  "9_weeks": ActionPlanTimeframe;
  "12_weeks": ActionPlanTimeframe;
  "6_months": ActionPlanTimeframe;
  "12_months": ActionPlanTimeframe;
}

const timeframeLabels = {
  "6_weeks": "6 Weeks",
  "9_weeks": "9 Weeks",
  "12_weeks": "12 Weeks",
  "6_months": "6 Months",
  "12_months": "12 Months"
};

interface CareerActionPlanProps {
  initialActionPlan?: ActionPlan | null;
}

const CareerActionPlan: React.FC<CareerActionPlanProps> = ({ initialActionPlan }) => {
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<keyof ActionPlan>("6_weeks");
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize component with data or fetch it
  useEffect(() => {
    console.log('CAP Debug: Component mounted or dependencies changed');
    console.log('CAP Debug: actionPlan state:', actionPlan);
    console.log('CAP Debug: initialActionPlan prop:', initialActionPlan);

    // If we have initialActionPlan and no actionPlan yet, use the initial
    if (initialActionPlan && !actionPlan) {
      console.log('CAP Debug: Setting action plan from initial prop');
      setActionPlan(initialActionPlan);
    } 
    // If no data at all and user authenticated, try loading it
    else if (!actionPlan && !initialActionPlan && user) {
      console.log('CAP Debug: No data available, attempting to load from database');
      loadOrCreateActionPlan();
    }
  }, [initialActionPlan, user]);

  // Function to load or generate the action plan
  const loadOrCreateActionPlan = async (forceGenerate = false) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage your career action plan.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    if (forceGenerate) setIsGenerating(true);

    try {
      let planToSet: ActionPlan | null = null;

      // Try fetching existing plan first if not forcing generation
      if (!forceGenerate) {
        console.log("CAP Debug: Attempting to fetch existing plan for user:", user.id);
        const { data: existingPlans, error: fetchError } = await supabase
          .from('career_pathway_results')
          .select('action_plan')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error("CAP Error: Fetching existing action plan:", fetchError);
        } else if (existingPlans?.action_plan && typeof existingPlans.action_plan === 'object') {
          console.log('CAP Debug: Found existing action plan:', existingPlans.action_plan);
          planToSet = existingPlans.action_plan as ActionPlan;
          toast({
            title: "Action Plan Loaded",
            description: "Your existing career action plan has been loaded.",
          });
        } else {
          console.log("CAP Debug: No valid existing action plan found in DB.");
        }
      }

      // Generate a new plan if needed or requested
      if (!planToSet || forceGenerate) {
        console.log(forceGenerate ? 'CAP Debug: Forcing generation...' : 'CAP Debug: No existing plan found, generating new one.');
        const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-career-action-plan', {
          body: { userId: user.id }
        });

        console.log('CAP Debug: Generation API Response:', functionData);

        if (functionError) {
          console.error("CAP Error: Function invocation failed:", functionError);
          throw new Error(`Function error: ${functionError.message}`);
        }

        if (functionData?.success && functionData?.data) {
          console.log('CAP Debug: Setting newly generated action plan:', functionData.data);
          planToSet = functionData.data as ActionPlan;

          // Save generated plan back to database
          console.log("CAP Debug: Attempting to save generated plan to DB for user:", user.id);
          const { data: latestResult, error: findError } = await supabase
            .from('career_pathway_results')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (findError) {
            console.error("CAP Error: Finding latest career_pathway_results entry to update:", findError);
          } else if (latestResult) {
            const { error: updateError } = await supabase
              .from('career_pathway_results')
              .update({ action_plan: planToSet, updated_at: new Date().toISOString() })
              .eq('id', latestResult.id);

            if (updateError) {
              console.error("CAP Error: Saving generated action plan to DB:", updateError);
              toast({ 
                title: "Warning", 
                description: "Failed to save the generated plan.", 
                variant: "destructive"
              });
            } else {
              console.log("CAP Debug: Successfully saved generated plan to DB.");
            }
          } else {
            console.warn("CAP Warn: No career_pathway_results found for user to save action plan against.");
          }

          toast({
            title: forceGenerate ? "Action Plan Regenerated" : "Action Plan Generated",
            description: "Your personalized career action plan is ready!",
          });
        } else {
          console.error("CAP Error: Generation failed or returned invalid data.", functionData);
          throw new Error(functionData?.error || "Failed to generate a valid action plan.");
        }
      }

      // Set the plan and default to 6_weeks tab
      if (planToSet) {
        setActionPlan(planToSet);
        setActiveTimeframe("6_weeks");
        console.log("CAP Debug: Action plan set successfully with default tab '6_weeks'");
      } else {
        throw new Error("The action plan could not be generated or loaded.");
      }

    } catch (error) {
      console.error("CAP Error: Error in loadOrCreateActionPlan:", error);
      toast({
        title: forceGenerate ? "Regeneration Failed" : "Loading Failed",
        description: `We couldn't ${forceGenerate ? 'regenerate' : 'load'} your action plan. Please try again.`,
        variant: "destructive",
        duration: 7000
      });
      setActionPlan(null);
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // Render loading state
  if (isLoading && !actionPlan) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Personal Career Action Plan</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading your plan...</span>
        </CardContent>
      </Card>
    );
  }

  // Render generate button if no plan and not loading
  if (!actionPlan) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Personal Career Action Plan</CardTitle>
          <CardDescription>
            Generate a customized career action plan based on your resume and career assessment results.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Button
            onClick={() => loadOrCreateActionPlan(true)}
            disabled={isGenerating}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate My Action Plan"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Get the valid keys that exist in the action plan for the tabs
  const validTimeframeKeys = Object.keys(actionPlan).filter(key => 
    timeframeLabels[key as keyof typeof timeframeLabels]
  ) as Array<keyof ActionPlan>;

  console.log("CAP Debug: Valid timeframe keys:", validTimeframeKeys);
  console.log("CAP Debug: Current active timeframe:", activeTimeframe);
  console.log("CAP Debug: Does activeTimeframe exist in validTimeframeKeys?", validTimeframeKeys.includes(activeTimeframe));

  // Ensure the active timeframe is valid
  if (!validTimeframeKeys.includes(activeTimeframe) && validTimeframeKeys.length > 0) {
    console.log("CAP Debug: Setting default active timeframe to first valid key:", validTimeframeKeys[0]);
    setActiveTimeframe(validTimeframeKeys[0]);
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your Career Action Plan</CardTitle>
            <CardDescription>
              A personalized roadmap to help you achieve your career goals. Select a timeframe below.
            </CardDescription>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionPlan(null)} className="flex-grow sm:flex-grow-0">
              Clear Plan
            </Button>
            <Button
              size="sm"
              onClick={() => loadOrCreateActionPlan(true)}
              disabled={isGenerating}
              className="flex-grow sm:flex-grow-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Plan"
              )}
            </Button>
          </div>
        </div>
        
        {/* Tabs for timeframe selection */}
        <Tabs value={activeTimeframe} onValueChange={(value) => setActiveTimeframe(value as keyof ActionPlan)} className="mt-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {validTimeframeKeys.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {timeframeLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Render content for each timeframe tab */}
        {validTimeframeKeys.map((timeframeKey) => {
          const timeframeData = actionPlan[timeframeKey];
          
          // Debug the current tab's data
          console.log(`CAP Debug: Rendering tab content for ${timeframeKey}:`, timeframeData);
          
          return (
            <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6 space-y-6">
              {/* Narrative/Overview Section */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                <h3 className="font-semibold text-lg mb-2">{timeframeLabels[timeframeKey]} Overview</h3>
                <p className="italic text-muted-foreground">
                  {timeframeData?.narrative || "No specific narrative provided for this period."}
                </p>
              </div>

              {/* Accordion for Details */}
              <Accordion type="multiple" className="w-full" defaultValue={["skills", "projects", "content", "milestones"]}>
                {/* Skills Section */}
                <AccordionItem value="skills">
                  <AccordionTrigger className="py-3 text-base font-medium hover:no-underline">
                    <div className="flex items-center">
                      <GraduationCap className="mr-2 h-5 w-5 text-primary" />
                      Skills to Acquire
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pl-8 pt-2">
                      {timeframeData?.skills && timeframeData.skills.length > 0 ? (
                        timeframeData.skills.map((skillItem, idx) => (
                          <div key={`skill-${timeframeKey}-${idx}`} className="space-y-2 pb-2 border-b border-border/30 last:border-b-0">
                            <h4 className="font-semibold text-primary/90">{skillItem.name}</h4>
                            {skillItem.courses && skillItem.courses.length > 0 ? (
                              <ul className="space-y-1 list-disc pl-5">
                                {skillItem.courses.map((course, courseIdx) => (
                                  <li key={`course-${timeframeKey}-${idx}-${courseIdx}`} className="text-sm">
                                    <span className="font-medium">{course.title}</span>
                                    {course.provider && (
                                      <span className="text-muted-foreground ml-1 text-xs">
                                        ({course.provider})
                                      </span>
                                    )}
                                    {course.url ? (
                                      <a href={course.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline text-xs">
                                        [Link]
                                      </a>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground pl-1">No specific courses listed for this skill.</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No specific skills listed for this period.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Projects Section */}
                <AccordionItem value="projects">
                  <AccordionTrigger className="py-3 text-base font-medium hover:no-underline">
                    <div className="flex items-center">
                      <Briefcase className="mr-2 h-5 w-5 text-primary" />
                      Projects to Build
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pl-8 pt-2">
                      {timeframeData?.projects && timeframeData.projects.length > 0 ? (
                        timeframeData.projects.map((project, idx) => (
                          <div key={`project-${timeframeKey}-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                            <h4 className="font-semibold text-primary/90">{project.title}</h4>
                            <p className="text-sm text-muted-foreground">{project.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No specific projects listed for this period.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Content Section */}
                <AccordionItem value="content">
                  <AccordionTrigger className="py-3 text-base font-medium hover:no-underline">
                    <div className="flex items-center">
                      <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                      Content to Share
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pl-8 pt-2">
                      {timeframeData?.content && timeframeData.content.length > 0 ? (
                        timeframeData.content.map((contentItem, idx) => (
                          <div key={`content-${timeframeKey}-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                            <h4 className="font-semibold text-primary/90">{contentItem.platform}</h4>
                            {contentItem.topics && contentItem.topics.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {contentItem.topics.map((topic, topicIdx) => (
                                  <li key={`topic-${timeframeKey}-${idx}-${topicIdx}`} className="text-sm">{topic}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground pl-1">No specific topics listed for this platform.</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No specific content sharing goals listed for this period.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Milestones Section */}
                <AccordionItem value="milestones">
                  <AccordionTrigger className="py-3 text-base font-medium hover:no-underline">
                    <div className="flex items-center">
                      <Target className="mr-2 h-5 w-5 text-primary" />
                      Milestones to Achieve
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-8 pt-2">
                      {timeframeData?.milestones && timeframeData.milestones.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-2">
                          {timeframeData.milestones.map((milestone, idx) => (
                            <li key={`milestone-${timeframeKey}-${idx}`} className="text-sm">{milestone}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No specific milestones listed for this period.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CareerActionPlan;
