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
  Calendar, // Keep Calendar import if needed elsewhere, remove if unused
  Loader2 // Import Loader2 for loading states
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
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null); // Initialize with null
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // Separate state for generation button
  const [activeTimeframe, setActiveTimeframe] = useState<string>("6_weeks");
  const { toast } = useToast();
  const { user } = useAuth();

  // Log the action plan for debugging
  useEffect(() => {
    console.log('CareerActionPlan component - actionPlan state:', actionPlan);
    console.log('CareerActionPlan component - initialActionPlan prop:', initialActionPlan);
    // If initialActionPlan exists and actionPlan is null, set it
    if (initialActionPlan && !actionPlan) {
       console.log('Setting action plan from initial prop');
       setActionPlan(initialActionPlan);
    }
  }, [actionPlan, initialActionPlan]);

  // Function to fetch or generate action plan
  const loadOrCreateActionPlan = async (forceGenerate = false) => {
     if (!user) {
       toast({
         title: "Authentication Required",
         description: "Please log in to manage your career action plan.",
         variant: "destructive"
       });
       return;
     }

     setIsLoading(true); // Use main loading state for initial load/fetch
     if (forceGenerate) setIsGenerating(true); // Use specific state for button spinner

     try {
       let planToSet: ActionPlan | null = null;

       // If not forcing generation, try fetching existing plan first
       if (!forceGenerate) {
         const { data: existingPlans, error: fetchError } = await supabase
           .from('career_pathway_results')
           .select('action_plan')
           .eq('user_id', user.id)
           .order('created_at', { ascending: false })
           .limit(1)
           .maybeSingle(); // Use maybeSingle to handle no rows gracefully

         if (fetchError) {
           console.error("Error fetching existing action plan:", fetchError);
           // Don't throw yet, maybe we can generate one
         }

         if (existingPlans?.action_plan) {
           console.log('Using existing action plan:', existingPlans.action_plan);
           planToSet = existingPlans.action_plan as ActionPlan;
           toast({
             title: "Action Plan Loaded",
             description: "Your existing career action plan has been loaded.",
           });
         }
       }

       // If no plan fetched or forceGenerate is true, generate a new one
       if (!planToSet || forceGenerate) {
         console.log(forceGenerate ? 'Forcing generation of new action plan.' : 'No existing plan found, generating new one.');
         const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-career-action-plan', {
           body: { userId: user.id }
         });

         console.log('Generation API Response:', functionData);

         if (functionError) throw functionError;

         if (functionData?.success && functionData?.data) {
           console.log('Setting newly generated action plan:', functionData.data);
           planToSet = functionData.data as ActionPlan;
           // Update the plan in the database as well (important!)
           const { error: updateError } = await supabase
             .from('career_pathway_results')
             .update({ action_plan: planToSet })
             .eq('user_id', user.id)
             // Consider updating only the latest result if multiple exist
             .order('created_at', { ascending: false })
             .limit(1);

            if (updateError) {
                console.error("Failed to save generated action plan to DB:", updateError);
                // Decide if this is critical - maybe toast an error?
            }

           toast({
             title: forceGenerate ? "Action Plan Regenerated" : "Action Plan Generated",
             description: "Your personalized career action plan is ready!",
           });
         } else {
           throw new Error(functionData?.message || "Failed to generate action plan from function.");
         }
       }

       // Set the plan in state
       setActionPlan(planToSet);

     } catch (error) {
       console.error("Error in loadOrCreateActionPlan:", error);
       toast({
         title: forceGenerate ? "Regeneration Failed" : "Loading Failed",
         description: `We couldn't ${forceGenerate ? 'regenerate' : 'load or generate'} your action plan. Error: ${error instanceof Error ? error.message : String(error)}`,
         variant: "destructive",
         duration: 7000 // Longer duration for errors
       });
       // Optionally set actionPlan to null or keep existing one?
       // setActionPlan(null); // Clears the view on error
     } finally {
       setIsLoading(false);
       setIsGenerating(false);
     }
  };

  // Fetch plan on initial mount if not provided
  useEffect(() => {
    if (!initialActionPlan && user) {
        console.log('Initial fetch triggered');
        loadOrCreateActionPlan();
    } else if (initialActionPlan) {
        // If initial plan is provided, set it directly if not already set
        if (!actionPlan) {
            console.log('Setting action plan from initial prop on mount');
            setActionPlan(initialActionPlan);
        }
    }
  }, [user, initialActionPlan]); // Re-run if user logs in or initialPlan changes

  // Render loading state or generate button if no plan and not loading
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
            onClick={() => loadOrCreateActionPlan(true)} // Pass true to force generation
            disabled={isGenerating} // Use isGenerating state here
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

  // Debug information for troubleshooting
  console.log("Rendering action plan view. Active timeframe:", activeTimeframe);
  console.log("Current actionPlan data:", actionPlan);

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Your Career Action Plan</CardTitle>
        <CardDescription>
          A personalized roadmap to help you achieve your career goals. Select a timeframe below.
        </CardDescription>
        <Tabs value={activeTimeframe} onValueChange={setActiveTimeframe} className="mt-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {Object.entries(timeframeLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-0"> {/* Remove default top padding */}
        {Object.entries(timeframeLabels).map(([timeframeKey, timeframeLabel]) => {
          // Explicitly cast timeframeKey to ensure TypeScript knows it's a valid key
          // and log the result for debugging
          const timeframeData = actionPlan[timeframeKey as keyof ActionPlan]: null;
                // right after your hooks:
          // const timeframeData = actionPlan ? actionPlan[activeTimeframe as keyof ActionPlan]: null;

          console.log(`TabsContent for ${timeframeKey}. Data exists:`, !!timeframeData);

          return (
            <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6 space-y-6"> {/* Added mt-6 */}
              {timeframeData ? (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                     <h3 className="font-semibold text-lg mb-2">{timeframeLabel} Overview</h3>
                     <p className="italic text-muted-foreground">
                       {timeframeData.narrative || "Focus on building your foundation and making progress."}
                     </p>
                  </div>

                  <Accordion type="multiple" className="w-full" defaultValue={["skills", "projects", "content", "milestones"]}>
                    {/* Skills */}
                    <AccordionItem value="skills">
                      <AccordionTrigger>Skills to Acquire</AccordionTrigger>
                      <AccordionContent>
                        {timeframeData?.skills.map((s, i) => (
                          <div key={i}>
                            <h4>{s.name}</h4>
                            <ul>
                              {s.courses.map((c, j) => (
                                <li key={j}>
                                  {c.title} {c.provider && `by ${c.provider}`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="skills">
                       <AccordionTrigger className="py-3 text-base font-medium">
                         <div className="flex items-center">
                           <GraduationCap className="mr-2 h-5 w-5 text-primary" />
                           Skills to Acquire
                         </div>
                       </AccordionTrigger>
                       <AccordionContent>
                         <div className="space-y-4 pl-8 pt-2">
                           {timeframeData.skills && timeframeData.skills.length > 0 ? (
                             timeframeData.skills.map((skillItem, idx) => (
                               <div key={`skill-${idx}`} className="space-y-2 pb-2 border-b border-border/30 last:border-b-0">
                                 <h4 className="font-semibold text-primary/90">{skillItem.name}</h4>
                                 {skillItem.courses && skillItem.courses.length > 0 ? (
                                   <ul className="space-y-1 list-disc pl-5">
                                     {skillItem.courses.map((course, courseIdx) => (
                                       <li key={`course-${courseIdx}`} className="text-sm">
                                         <span className="font-medium">{course.title}</span>
                                         {course.provider && (
                                           <span className="text-muted-foreground ml-1 text-xs">
                                             ({course.provider})
                                           </span>
                                         )}
                                         {/* Added link rendering */}
                                         {course.url ? (
                                             <a href={course.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline text-xs">
                                                 [Link]
                                             </a>
                                         ) : null}
                                       </li>
                                     ))}
                                   </ul>
                                 ) : (
                                    <p className="text-sm text-muted-foreground pl-1">No specific courses listed. Consider searching for relevant training.</p>
                                 )}
                               </div>
                             ))
                           ) : (
                             <p className="text-muted-foreground text-sm">No specific skills listed for this period.</p>
                           )}
                         </div>
                       </AccordionContent>
                     </AccordionItem>

                    {/* Projects */}
                    <AccordionItem value="projects">
                       <AccordionTrigger className="py-3 text-base font-medium">
                         <div className="flex items-center">
                           <Briefcase className="mr-2 h-5 w-5 text-primary" />
                           Projects to Build
                         </div>
                       </AccordionTrigger>
                       <AccordionContent>
                         <div className="space-y-4 pl-8 pt-2">
                           {timeframeData.projects && timeframeData.projects.length > 0 ? (
                             timeframeData.projects.map((project, idx) => (
                               <div key={`project-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
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

                    {/* Content */}
                    <AccordionItem value="content">
                       <AccordionTrigger className="py-3 text-base font-medium">
                         <div className="flex items-center">
                           <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                           Content to Share
                         </div>
                       </AccordionTrigger>
                       <AccordionContent>
                         <div className="space-y-4 pl-8 pt-2">
                           {timeframeData.content && timeframeData.content.length > 0 ? (
                             timeframeData.content.map((contentItem, idx) => (
                               <div key={`content-${idx}`} className="space-y-1 pb-2 border-b border-border/30 last:border-b-0">
                                 <h4 className="font-semibold text-primary/90">{contentItem.platform}</h4>
                                 {contentItem.topics && contentItem.topics.length > 0 ? (
                                     <ul className="list-disc pl-5 space-y-1">
                                       {contentItem.topics.map((topic, topicIdx) => (
                                         <li key={`topic-${topicIdx}`} className="text-sm">{topic}</li>
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

                    {/* Milestones */}
                    <AccordionItem value="milestones">
                       <AccordionTrigger className="py-3 text-base font-medium">
                         <div className="flex items-center">
                           <Target className="mr-2 h-5 w-5 text-primary" />
                           Milestones to Achieve
                         </div>
                       </AccordionTrigger>
                       <AccordionContent>
                         <div className="pl-8 pt-2">
                           {timeframeData.milestones && timeframeData.milestones.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-2">
                                {timeframeData.milestones.map((milestone, idx) => (
                                  <li key={`milestone-${idx}`} className="text-sm">{milestone}</li>
                                ))}
                              </ul>
                           ) : (
                              <p className="text-muted-foreground text-sm">No specific milestones listed for this period.</p>
                           )}
                         </div>
                       </AccordionContent>
                     </AccordionItem>
                  </Accordion>

                  {/* Action Buttons for this timeframe */}
                  <div className="flex justify-end pt-4 border-t border-border/30 mt-6">
                    <Button variant="outline" size="sm" onClick={() => setActionPlan(null)} className="mr-2">
                      Reset Plan
                    </Button>
                    <Button
                       size="sm"
                       onClick={() => loadOrCreateActionPlan(true)} // Pass true to force regeneration
                       disabled={isGenerating} // Use specific generating state
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
                </>
              ) : (
                 // Displayed if timeframeData for this specific timeframeKey is missing
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">No action plan data available for the {timeframeLabel} timeframe.</p>
                 </div>
              )}
            </TabsContent>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CareerActionPlan;
