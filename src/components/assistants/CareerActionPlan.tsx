
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

const timeframeLabels: Record<keyof ActionPlan, string> = {
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
  // Internal state to hold the action plan, primarily derived from the prop
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  // State to track if regeneration is in progress
  const [isGenerating, setIsGenerating] = useState(false);
  // State for the currently active tab
  const [activeTimeframe, setActiveTimeframe] = useState<keyof ActionPlan>("6_weeks"); // Default to 6 weeks

  const { toast } = useToast();
  const { user } = useAuth();

  // Effect to update internal state when the prop changes
  useEffect(() => {
    console.log('CAP Debug: useEffect triggered. initialActionPlan:', initialActionPlan);
    if (initialActionPlan && typeof initialActionPlan === 'object' && Object.keys(initialActionPlan).length > 0) {
      console.log('CAP Debug: Setting internal actionPlan state from initialActionPlan prop.');
      setActionPlan(initialActionPlan);
      // Ensure active timeframe is valid if the plan just loaded
      const validKeys = Object.keys(initialActionPlan).filter(key => timeframeLabels[key as keyof ActionPlan]) as Array<keyof ActionPlan>;
      if (validKeys.length > 0) {
         // Set default tab only if the current one isn't valid or doesn't exist in the new plan
         if (!validKeys.includes(activeTimeframe) || !initialActionPlan[activeTimeframe]) {
             console.log(`CAP Debug: Setting active timeframe to default ${validKeys[0]}.`);
             setActiveTimeframe(validKeys[0]);
         }
      } else {
         console.warn("CAP Warn: initialActionPlan received but seems to have no valid timeframe keys.");
         setActionPlan(null); // Treat as no plan if keys are invalid
         setActiveTimeframe("6_weeks"); // Reset tab if plan becomes invalid
      }
    } else {
      console.log('CAP Debug: initialActionPlan is null or invalid, clearing internal state.');
      // If the prop becomes null/invalid, clear the internal state
      setActionPlan(null);
      setActiveTimeframe("6_weeks"); // Reset tab
    }
  }, [initialActionPlan]); // Depend only on the prop


  // Function to regenerate the action plan
  const regenerateActionPlan = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to regenerate your career action plan.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    console.log('CAP Debug: Starting regeneration...');

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-career-action-plan', {
        body: { userId: user.id }
      });

      console.log('CAP Debug: Regeneration API Response:', functionData);

      if (functionError) {
        console.error("CAP Error: Regeneration function invocation failed:", functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (functionData?.success && functionData?.data && typeof functionData.data === 'object' && Object.keys(functionData.data).length > 0) {
        const newPlan = functionData.data as ActionPlan;
        console.log('CAP Debug: Setting regenerated action plan:', newPlan);
        setActionPlan(newPlan); // Update internal state directly

        // Find the first valid timeframe key to set as active
        const validKeys = Object.keys(newPlan).filter(key => timeframeLabels[key as keyof ActionPlan]) as Array<keyof ActionPlan>;
        const defaultTimeframe = validKeys.length > 0 ? validKeys[0] : "6_weeks";
        setActiveTimeframe(defaultTimeframe);
        console.log('CAP Debug: Resetting active timeframe to:', defaultTimeframe);

        // Save regenerated plan back to database
        console.log("CAP Debug: Attempting to save regenerated plan to DB for user:", user.id);
        // Find the latest entry to update it
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
              .update({ action_plan: newPlan, updated_at: new Date().toISOString() })
              .eq('id', latestResult.id);

            if (updateError) {
              console.error("CAP Error: Saving regenerated action plan to DB:", updateError);
              toast({
                title: "Warning",
                description: "Failed to save the regenerated plan.",
                variant: "destructive"
              });
            } else {
              console.log("CAP Debug: Successfully saved regenerated plan to DB.");
            }
          } else {
            console.warn("CAP Warn: No career_pathway_results found for user to save action plan against.");
          }

        toast({
          title: "Action Plan Regenerated",
          description: "Your updated career action plan is ready!",
        });

      } else {
        console.error("CAP Error: Regeneration failed or returned invalid data.", functionData);
        throw new Error(functionData?.error || "Failed to generate a valid action plan.");
      }
    } catch (error) {
      console.error("CAP Error: Error in regenerateActionPlan:", error);
      toast({
        title: "Regeneration Failed",
        description: `We couldn't regenerate your action plan. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
        duration: 7000
      });
      // Do not clear the existing plan on failure, keep the old one
    } finally {
      setIsGenerating(false);
      console.log('CAP Debug: Regeneration finished.');
    }
  };

  // Render generate button if no plan (based on internal state now)
  if (!actionPlan) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Personal Career Action Plan</CardTitle>
          <CardDescription>
            Your action plan is not available. You can try generating one or regenerating it if it failed previously.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Button
            onClick={regenerateActionPlan} // Use regenerate function directly
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
              "Generate / Regenerate Plan"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Get the valid keys that exist in the current action plan state
  const validTimeframeKeys = Object.keys(actionPlan).filter(key =>
    timeframeLabels[key as keyof ActionPlan]
  ) as Array<keyof ActionPlan>;

  console.log("CAP Debug: Render - Valid timeframe keys:", validTimeframeKeys);
  console.log("CAP Debug: Render - Current active timeframe:", activeTimeframe);

  // Ensure the active timeframe is valid among the available keys
  const currentActiveTimeframe = validTimeframeKeys.includes(activeTimeframe) ? activeTimeframe : (validTimeframeKeys[0] || "6_weeks");
  if (currentActiveTimeframe !== activeTimeframe) {
     console.warn(`CAP Warn: Render - Active timeframe '${activeTimeframe}' invalid or data missing, switching to '${currentActiveTimeframe}'.`);
     // Use a microtask to avoid direct state update during render cycle issues if possible, though React might handle this.
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
            {/* Clear Plan Button - Sets internal state to null */}
            <Button variant="outline" size="sm" onClick={() => { setActionPlan(null); console.log('CAP Debug: Plan cleared by user.'); }} className="flex-grow sm:flex-grow-0">
              Clear Plan
            </Button>
            <Button
              size="sm"
              onClick={regenerateActionPlan}
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
        <Tabs
           value={currentActiveTimeframe} // Use the validated active timeframe
           onValueChange={(value) => {
             console.log("CAP Debug: Tab changed to:", value);
             if (validTimeframeKeys.includes(value as keyof ActionPlan)) {
               setActiveTimeframe(value as keyof ActionPlan);
             } else {
               console.warn(`CAP Warn: Attempted to switch to invalid tab value: ${value}`);
             }
           }}
           className="mt-4"
         >
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {validTimeframeKeys.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {timeframeLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>

         {/* Render content for each timeframe tab */}
          {validTimeframeKeys.map((timeframeKey) => {
            // Get data for the current timeframe key being mapped
            const timeframeData = actionPlan[timeframeKey];

            console.log(`CAP Debug: Processing TabsContent for ${timeframeKey}. Data available:`, !!timeframeData);

            // Ensure data exists for this key before rendering content
            if (!timeframeData) {
              console.warn(`CAP Warn: No data found for timeframe key: ${timeframeKey}. Rendering placeholder.`);
              return (
                <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6">
                  <p className="text-muted-foreground p-4">No action plan details available for this timeframe ({timeframeLabels[timeframeKey]}).</p>
                </TabsContent>
              );
            }

            // Render the actual content if data is present
            return (
              <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6 space-y-6">
                {/* Narrative/Overview Section */}
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h3 className="font-semibold text-lg mb-2">{timeframeLabels[timeframeKey]} Overview</h3>
                  <p className="italic text-muted-foreground">
                    {timeframeData.narrative || "No specific narrative provided for this period."}
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
                        {/* Added check for timeframeData.skills */}
                        {timeframeData.skills && Array.isArray(timeframeData.skills) && timeframeData.skills.length > 0 ? (
                          timeframeData.skills.map((skillItem, idx) => {
                            // Check if skillItem is a valid object with the expected structure
                            if (!skillItem || typeof skillItem !== 'object' || !('name' in skillItem)) {
                              console.warn(`CAP Warn: Invalid skill item at index ${idx}:`, skillItem);
                              return (
                                <div key={`invalid-skill-${timeframeKey}-${idx}`} className="text-sm text-red-500">
                                  Invalid skill data
                                </div>
                              );
                            }

                            return (
                              <div key={`skill-${timeframeKey}-${idx}`} className="space-y-2 pb-2 border-b border-border/30 last:border-b-0">
                                <h4 className="font-semibold text-primary/90">{skillItem.name || 'Unnamed Skill'}</h4>
                                {/* Added check for skillItem.courses */}
                                {skillItem.courses && Array.isArray(skillItem.courses) && skillItem.courses.length > 0 ? (
                                  <ul className="space-y-1 list-disc pl-5">
                                    {skillItem.courses.map((course, courseIdx) => {
                                      // Verify course is a valid object
                                      if (!course || typeof course !== 'object') {
                                        console.warn(`CAP Warn: Invalid course at index ${courseIdx} for skill ${skillItem.name}:`, course);
                                        return null;
                                      }

                                      return (
                                        <li key={`course-${timeframeKey}-${idx}-${courseIdx}`} className="text-sm">
                                          <span className="font-medium">{course.title || 'Unnamed Course'}</span>
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
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground pl-1">No specific courses listed for this skill.</p>
                                )}
                              </div>
                            );
                          })
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
                        {/* Added check for timeframeData.projects */}
                        {timeframeData.projects && Array.isArray(timeframeData.projects) && timeframeData.projects.length > 0 ? (
                          timeframeData.projects.map((project, idx) => {
                            // Verify project is a valid object
                            if (!project || typeof project !== 'object') {
                              console.warn(`CAP Warn: Invalid project at index ${idx}:`, project);
                              return null;
                            }

                            return (
                              <div key={`project-${timeframeKey}-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                                <h4 className="font-semibold text-primary/90">{project.title || 'Unnamed Project'}</h4>
                                <p className="text-sm text-muted-foreground">{project.description || 'No description.'}</p>
                              </div>
                            );
                          })
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
                        {/* Added check for timeframeData.content */}
                        {timeframeData.content && Array.isArray(timeframeData.content) && timeframeData.content.length > 0 ? (
                          timeframeData.content.map((contentItem, idx) => {
                            // Verify contentItem is a valid object
                            if (!contentItem || typeof contentItem !== 'object') {
                              console.warn(`CAP Warn: Invalid content item at index ${idx}:`, contentItem);
                              return null;
                            }

                            return (
                              <div key={`content-${timeframeKey}-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                                <h4 className="font-semibold text-primary/90">{contentItem.platform || 'Unspecified Platform'}</h4>
                                {/* Added check for contentItem.topics */}
                                {contentItem.topics && Array.isArray(contentItem.topics) && contentItem.topics.length > 0 ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {contentItem.topics.map((topic, topicIdx) => (
                                      <li key={`topic-${timeframeKey}-${idx}-${topicIdx}`} className="text-sm">{topic || 'Unspecified Topic'}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground pl-1">No specific topics listed for this platform.</p>
                                )}
                              </div>
                            );
                          })
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
                        {/* Added check for timeframeData.milestones */}
                        {timeframeData.milestones && Array.isArray(timeframeData.milestones) && timeframeData.milestones.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-2">
                            {timeframeData.milestones.map((milestone, idx) => (
                              <li key={`milestone-${timeframeKey}-${idx}`} className="text-sm">{milestone || 'Unspecified Milestone'}</li>
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
        </Tabs>
      </CardHeader>

      {/* Content area removed from header, now inside Tabs */}

    </Card>
  );
};

export default CareerActionPlan;
