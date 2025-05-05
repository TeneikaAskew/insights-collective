
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
  const [activeTimeframe, setActiveTimeframe] = useState<keyof ActionPlan>("6_weeks"); // Use keyof ActionPlan
  const { toast } = useToast();
  const { user } = useAuth();

  // Log the action plan for debugging
  useEffect(() => {
    console.log('CAP Debug: actionPlan state:', actionPlan);
    console.log('CAP Debug: initialActionPlan prop:', initialActionPlan);
    // If initialActionPlan exists and actionPlan is null, set it
    if (initialActionPlan && !actionPlan) {
       console.log('CAP Debug: Setting action plan from initial prop');
       setActionPlan(initialActionPlan);
       // Set initial active tab if plan exists
       const firstKey = Object.keys(initialActionPlan)[0] as keyof ActionPlan | undefined;
       if (firstKey) {
         setActiveTimeframe(firstKey);
       }
    } else if (!initialActionPlan && !actionPlan && user) {
        // If no initial plan, no current plan, and user exists, try loading
        console.log('CAP Debug: Initial fetch triggered on mount');
        loadOrCreateActionPlan();
    }
  }, [actionPlan, initialActionPlan, user]); // Dependencies updated

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

     setIsLoading(true);
     if (forceGenerate) setIsGenerating(true);

     try {
       let planToSet: ActionPlan | null = null;
       let fetchedPlan = false;

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
           // Continue to generation attempt
         } else if (existingPlans?.action_plan && typeof existingPlans.action_plan === 'object' && Object.keys(existingPlans.action_plan).length > 0) {
           console.log('CAP Debug: Found existing action plan:', existingPlans.action_plan);
           planToSet = existingPlans.action_plan as ActionPlan;
           fetchedPlan = true;
           toast({
             title: "Action Plan Loaded",
             description: "Your existing career action plan has been loaded.",
           });
         } else {
             console.log("CAP Debug: No valid existing action plan found in DB.");
         }
       }

       // Generate a new one if no plan fetched or forceGenerate is true
       if (!planToSet || forceGenerate) {
         console.log(forceGenerate ? 'CAP Debug: Forcing generation...' : 'CAP Debug: No existing plan found or regeneration forced, generating new one.');
         const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-career-action-plan', {
           body: { userId: user.id }
         });

         console.log('CAP Debug: Generation API Response:', functionData);

         if (functionError) {
            console.error("CAP Error: Function invocation failed:", functionError);
            throw new Error(`Function error: ${functionError.message}`);
         }

         if (functionData?.success && functionData?.data && typeof functionData.data === 'object' && Object.keys(functionData.data).length > 0) {
           console.log('CAP Debug: Setting newly generated action plan:', functionData.data);
           planToSet = functionData.data as ActionPlan;

           // Attempt to save the newly generated plan back to the latest result
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
                 .update({ action_plan: planToSet, updated_at: new Date().toISOString() }) // Add updated_at
                 .eq('id', latestResult.id);

               if (updateError) {
                   console.error("CAP Error: Saving generated action plan to DB:", updateError);
                   toast({ title: "Warning", description: "Failed to save the generated plan.", variant: "destructive"});
               } else {
                   console.log("CAP Debug: Successfully saved generated plan to DB.");
               }
           } else {
                console.warn("CAP Warn: No career_pathway_results found for user to save action plan against.");
                // Optionally create a new entry? Depends on application logic.
                // For now, we'll just use the plan in the state.
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

       // Set the plan in state
       if (planToSet && typeof planToSet === 'object' && Object.keys(planToSet).length > 0) {
           setActionPlan(planToSet);
           // Ensure active timeframe is valid
           const firstKey = Object.keys(planToSet)[0] as keyof ActionPlan | undefined;
           if (firstKey && !Object.keys(timeframeLabels).includes(activeTimeframe)) {
               setActiveTimeframe(firstKey);
               console.log("CAP Debug: Resetting active timeframe to first valid key:", firstKey);
           } else {
               console.log("CAP Debug: Active timeframe is already valid:", activeTimeframe);
           }
       } else {
           console.error("CAP Error: Plan to set was null or invalid.");
           setActionPlan(null); // Ensure state is null if plan is invalid
           throw new Error("The generated or fetched action plan was empty or invalid.");
       }

     } catch (error) {
       console.error("CAP Error: Error in loadOrCreateActionPlan:", error);
       toast({
         title: forceGenerate ? "Regeneration Failed" : "Loading Failed",
         description: `We couldn't ${forceGenerate ? 'regenerate' : 'load or generate'} your action plan. Please try again. ${error instanceof Error ? error.message : ''}`,
         variant: "destructive",
         duration: 7000
       });
       setActionPlan(null); // Clear the view on error
     } finally {
       setIsLoading(false);
       setIsGenerating(false);
     }
  };

  // Removed the second useEffect that called loadOrCreateActionPlan, consolidated into the first one.

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
            onClick={() => loadOrCreateActionPlan(true)} // Force generation
            disabled={isGenerating || isLoading} // Disable if loading or generating
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
        {/* Optional: Add error message display here if needed */}
      </Card>
    );
  }

  // Render the action plan view
  console.log("CAP Debug: Rendering action plan view. Active timeframe:", activeTimeframe);
  console.log("CAP Debug: Current actionPlan data:", actionPlan);

  // Ensure activeTimeframe is a valid key, default if necessary
  const validTimeframeKeys = Object.keys(timeframeLabels) as Array<keyof ActionPlan>;
  const currentActiveTimeframe = validTimeframeKeys.includes(activeTimeframe)
    ? activeTimeframe
    : validTimeframeKeys[0]; // Default to the first valid key

  if (!validTimeframeKeys.includes(activeTimeframe)) {
      console.warn(`CAP Warn: Invalid activeTimeframe '${activeTimeframe}', defaulting to '${currentActiveTimeframe}'`);
      // It's better to set state, but causes re-render loop potential.
      // useEffect handles the initial setting. This is a fallback for render.
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
                  onClick={() => loadOrCreateActionPlan(true)} // Force regeneration
                  disabled={isGenerating || isLoading}
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
        <Tabs value={currentActiveTimeframe} onValueChange={(value) => setActiveTimeframe(value as keyof ActionPlan)} className="mt-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {validTimeframeKeys.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {timeframeLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-0"> {/* Remove default top padding */}
        {validTimeframeKeys.map((timeframeKey) => {
          // Get data for the specific timeframe key for this iteration
          const timeframeData = actionPlan?.[timeframeKey] ?? null;
          const timeframeLabel = timeframeLabels[timeframeKey];

          // Log data for debugging this specific tab's render pass
          // console.log(`CAP Debug: [TabsContent Map] Key: ${timeframeKey}, Has Data: ${!!timeframeData}`);

          return (
            // TabsContent renders its children, but is only *visible* when its `value` matches the Tabs `value`
            <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6 space-y-6">
              {/* Check if data exists for this specific timeframe */}
              {timeframeData ? (
                <>
                  {/* Narrative/Overview Section */}
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                     <h3 className="font-semibold text-lg mb-2">{timeframeLabel} Overview</h3>
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
                           {timeframeData.skills && timeframeData.skills.length > 0 ? (
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
                           {timeframeData.projects && timeframeData.projects.length > 0 ? (
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
                           {timeframeData.content && timeframeData.content.length > 0 ? (
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
                           {timeframeData.milestones && timeframeData.milestones.length > 0 ? (
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

                  {/* Removed redundant action buttons from here, moved to header */}

                </>
              ) : (
                 // Displayed if timeframeData for this specific timeframeKey is missing
                 <div className="text-center py-10">
                    <p className="text-muted-foreground">No action plan data available for the {timeframeLabel} timeframe.</p>
                    {/* Optional: Add a button to generate/regenerate if data is missing? */}
                    {/* <Button variant="link" onClick={() => loadOrCreateActionPlan(true)}>Try generating data</Button> */}
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
