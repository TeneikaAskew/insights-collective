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

interface CourseData {
  title: string;
  provider: string;
  url?: string;
}

interface SkillData {
  name: string;
  courses: CourseData[];
}

interface ProjectData {
  title: string;
  description: string;
}

interface ContentData {
  platform: string;
  topics: string[];
}

interface ActionPlanTimeframe {
  skills: SkillData[];
  projects: ProjectData[];
  content: ContentData[];
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

// Helper function to validate action plan data
const isValidActionPlan = (plan: any): plan is ActionPlan => {
  if (!plan || typeof plan !== 'object') return false;
  
  // Check if at least one timeframe key exists
  const hasAnyTimeframe = ["6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"]
    .some(key => plan.hasOwnProperty(key));
  
  return hasAnyTimeframe;
};

// Helper to check if a timeframe is valid
const isValidTimeframe = (data: any): data is ActionPlanTimeframe => {
  return data && typeof data === 'object' &&
    (Array.isArray(data.skills) || Array.isArray(data.projects) || 
     Array.isArray(data.content) || Array.isArray(data.milestones));
};

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
    if (isValidActionPlan(initialActionPlan)) {
      console.log('CAP Debug: Setting internal actionPlan state from initialActionPlan prop.');
      setActionPlan(initialActionPlan);
      // Ensure active timeframe is valid if the plan just loaded
      const validKeys = Object.keys(initialActionPlan).filter(key => 
        timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(initialActionPlan[key as keyof ActionPlan])
      ) as Array<keyof ActionPlan>;
      
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

      if (functionData?.success && isValidActionPlan(functionData.data)) {
        const newPlan = functionData.data as ActionPlan;
        console.log('CAP Debug: Setting regenerated action plan:', newPlan);
        setActionPlan(newPlan); // Update internal state directly

        // Find the first valid timeframe key to set as active
        const validKeys = Object.keys(newPlan).filter(key => 
          timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(newPlan[key as keyof ActionPlan])
        ) as Array<keyof ActionPlan>;
        
        const defaultTimeframe = validKeys.length > 0 ? validKeys[0] : "6_weeks";
        setActiveTimeframe(defaultTimeframe);
        console.log('CAP Debug: Resetting active timeframe to:', defaultTimeframe);

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
    timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(actionPlan[key as keyof ActionPlan])
  ) as Array<keyof ActionPlan>;

  console.log("CAP Debug: Render - Valid timeframe keys:", validTimeframeKeys);
  console.log("CAP Debug: Render - Current active timeframe:", activeTimeframe);

  // Ensure the active timeframe is valid among the available keys
  const currentActiveTimeframe = validTimeframeKeys.includes(activeTimeframe) ? activeTimeframe : (validTimeframeKeys[0] || "6_weeks");
  if (currentActiveTimeframe !== activeTimeframe) {
     console.warn(`CAP Warn: Render - Active timeframe '${activeTimeframe}' invalid or data missing, switching to '${currentActiveTimeframe}'.`);
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
            if (!isValidTimeframe(timeframeData)) {
              console.warn(`CAP Warn: No valid data found for timeframe key: ${timeframeKey}. Rendering placeholder.`);
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
                        {Array.isArray(timeframeData.skills) && timeframeData.skills.length > 0 ? (
                          timeframeData.skills.map((skillItem, idx) => {
                            // Validate the skill object structure
                            if (!skillItem || typeof skillItem !== 'object') {
                              return null;
                            }
                            
                            return (
                              <div key={`skill-${timeframeKey}-${idx}`} className="space-y-2 pb-2 border-b border-border/30 last:border-b-0">
                                <h4 className="font-semibold text-primary/90">
                                  {typeof skillItem.name === 'string' ? skillItem.name : 'Unnamed Skill'}
                                </h4>
                                {Array.isArray(skillItem.courses) && skillItem.courses.length > 0 ? (
                                  <ul className="space-y-1 list-disc pl-5">
                                    {skillItem.courses.map((course, courseIdx) => {
                                      // Handle different course data formats
                                      let courseTitle = '';
                                      let courseProvider = '';
                                      let courseUrl = '';
                                      
                                      if (typeof course === 'string') {
                                        courseTitle = course;
                                      } else if (course && typeof course === 'object') {
                                        courseTitle = course.title || 'Unnamed Course';
                                        courseProvider = course.provider || '';
                                        courseUrl = course.url || '';
                                      }
                                      
                                      if (!courseTitle) return null;
                                      
                                      return (
                                        <li key={`course-${timeframeKey}-${idx}-${courseIdx}`} className="text-sm">
                                          <span className="font-medium">{courseTitle}</span>
                                          {courseProvider && (
                                            <span className="text-muted-foreground ml-1 text-xs">
                                              ({courseProvider})
                                            </span>
                                          )}
                                          {courseUrl && (
                                            <a href={courseUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline text-xs">
                                              [Link]
                                            </a>
                                          )}
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
                        {Array.isArray(timeframeData.projects) && timeframeData.projects.length > 0 ? (
                          timeframeData.projects.map((project, idx) => {
                            // Validate project object
                            if (!project || typeof project !== 'object') return null;
                            
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
                        {Array.isArray(timeframeData.content) && timeframeData.content.length > 0 ? (
                          timeframeData.content.map((contentItem, idx) => {
                            // Validate content item object
                            if (!contentItem || typeof contentItem !== 'object') return null;
                            
                            return (
                              <div key={`content-${timeframeKey}-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                                <h4 className="font-semibold text-primary/90">{contentItem.platform || 'Unspecified Platform'}</h4>
                                {Array.isArray(contentItem.topics) && contentItem.topics.length > 0 ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {contentItem.topics.map((topic, topicIdx) => {
                                      if (typeof topic !== 'string' && typeof topic !== 'number') return null;
                                      return (
                                        <li key={`topic-${timeframeKey}-${idx}-${topicIdx}`} className="text-sm">
                                          {String(topic) || 'Unspecified Topic'}
                                        </li>
                                      );
                                    })}
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
                        {Array.isArray(timeframeData.milestones) && timeframeData.milestones.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-2">
                            {timeframeData.milestones.map((milestone, idx) => {
                              if (typeof milestone !== 'string' && typeof milestone !== 'number') return null;
                              return (
                                <li key={`milestone-${timeframeKey}-${idx}`} className="text-sm">
                                  {String(milestone) || 'Unspecified Milestone'}
                                </li>
                              );
                            })}
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
    </Card>
  );
};

export default CareerActionPlan;
